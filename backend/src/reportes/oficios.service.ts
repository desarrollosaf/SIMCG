import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { existsSync } from 'fs';
import * as path from 'path';
import { Declaracion } from '../database/models/declaracion.model';
import {
  EnvioCorreo,
  TIPO_CORREO_PREVENTIVO,
  TIPO_CORREO_REMISION,
} from '../database/models/envio-correo.model';
import { ServidorPublico } from '../database/models/servidor-publico.model';
import { TipoDepartamento } from '../database/models/tipo-departamento.model';
import { TipoDependencia } from '../database/models/tipo-dependencia.model';
import { TipoDireccion } from '../database/models/tipo-direccion.model';
import {
  TIPO_MOV_INGRESO,
  TIPO_MOV_REINGRESO,
  TipoMovimientoMcg,
} from '../database/models/tipo-movimiento-mcg.model';
import { User } from '../database/models/user.model';
import { CorreoService } from '../documentos/correo.service';
import { PdfService } from '../documentos/pdf.service';
import { PlantillasService } from '../documentos/plantillas.service';
import { hoyMexico } from '../servidores/movimientos.reglas';
import { OficioOmisoDto, OficioPreventivoDto } from './dto/reportes.dto';
import { fechaLarga } from './fechas-es';
import {
  direccionRemision,
  fraccionArticulo34,
  fraccionArticulo34Final,
  inicialesDe,
  nombreMayusculas,
  normalizarFolio,
  numeroOficio,
  plazoPreventivo,
  primeraMayuscula,
} from './oficios';

export const ASUNTO_CORREO_PREVENTIVO = 'Oficio Preventivo DeclaraLegisNet.';
export const IMAGEN_ENCABEZADO_CORREO = 'IMG_MAILB.png';
export const IMAGEN_CORREO_INICIAL = 'CORREO_DECLARALEGIS_INICIAL.png';
export const IMAGEN_CORREO_CONCLUSION = 'CORREO_DECLARALEGIS_CONCLUSION.png';

const MARGENES_CARTA = {
  top: '3cm',
  right: '2cm',
  bottom: '2cm',
  left: '2cm',
};

export interface PdfGenerado {
  buffer: Buffer;
  nombre: string;
}

/** Datos del servidor y la declaración que usan los dos oficios. */
export interface DatosOficio {
  servidor: {
    nombre: string;
    primerApellido: string;
    segundoApellido: string | null;
    cargo: string;
    dependencia: string | null;
    direccionId: number | null;
    direccion: string | null;
  };
  tipoMovimientoId: number;
  /** Valor del catálogo tipo_movimientos_mcg (tal como está en la base). */
  tipoMovimiento: string;
  folio: string;
  iniciales: string;
  /** Hoy (America/Mexico_City), 'YYYY-MM-DD'. */
  hoy: string;
}

export interface DatosOficioRemision extends DatosOficio {
  folioDadp: string;
  fechaOficio: string;
  fechaPadron: string;
  soporte: string;
}

export interface DatosOficioPreventivo extends DatosOficio {
  /** Fecha del oficio capturada por el usuario, 'YYYY-MM-DD'. */
  fechaOficio: string;
}

const escapar = (t: string): string =>
  t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

@Injectable()
export class OficiosService {
  private readonly logger = new Logger(OficiosService.name);
  // Hermana de plantillas/ (src/ en desarrollo, dist/ compilado).
  private readonly carpetaImagenes = path.resolve(
    __dirname,
    '..',
    'assets',
    'img',
  );

  constructor(
    @InjectModel(ServidorPublico)
    private readonly servidorModel: typeof ServidorPublico,
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(TipoMovimientoMcg)
    private readonly tipoMovimientoModel: typeof TipoMovimientoMcg,
    @InjectModel(EnvioCorreo)
    private readonly envioCorreoModel: typeof EnvioCorreo,
    @InjectModel(Declaracion, 'declaranet')
    private readonly declaracionModel: typeof Declaracion,
    private readonly plantillas: PlantillasService,
    private readonly pdf: PdfService,
    private readonly correo: CorreoService,
  ) {}

  // ---- Consulta del número de oficio ya registrado ----

  /** no_oficio ya registrado para la declaración (remisión = 2, preventivo = 1), o null. */
  async oficioPrevio(
    declaracionId: number,
    tipoCorreo: number,
  ): Promise<{ noOficio: string | null }> {
    const declaracion = await this.declaracionModel.findByPk(declaracionId);
    if (!declaracion) throw new NotFoundException('Declaración no encontrada.');
    const envio = await this.envioCorreoModel.findOne({
      where: { declaracionId, tipoCorreo },
      order: [['id', 'ASC']],
    });
    return { noOficio: envio?.noOficio ?? null };
  }

  // ---- HTML de los oficios (sin Chromium) ----

  htmlRemision(d: DatosOficioRemision): string {
    const anio = d.hoy.slice(0, 4);
    const contenido = this.plantillas.renderizar('oficio-remision', {
      fecha: fechaLarga(d.hoy),
      numero: numeroOficio(d.folio, anio),
      folioDadp: d.folioDadp,
      fechaOficio: fechaLarga(d.fechaOficio),
      fechaPadron: fechaLarga(d.fechaPadron),
      fraccion: fraccionArticulo34(d.tipoMovimientoId),
      fraccionFinal: fraccionArticulo34Final(d.tipoMovimientoId),
      nombre: nombreMayusculas(
        d.servidor.nombre,
        d.servidor.primerApellido,
        d.servidor.segundoApellido,
      ),
      cargo: d.servidor.cargo.toUpperCase(),
      direccion: direccionRemision(
        d.servidor.direccionId,
        d.servidor.direccion,
      ),
      tipoMovimiento: primeraMayuscula(d.tipoMovimiento),
      soporte: d.soporte,
      iniciales: d.iniciales,
    });
    return this.plantillas.renderizar('_base-carta', { contenido });
  }

  htmlPreventivo(d: DatosOficioPreventivo): string {
    return this.plantillas.renderizar('_base-carta', {
      contenido: this.fragmentoPreventivo(d, true),
    });
  }

  private fragmentoPreventivo(
    d: DatosOficioPreventivo,
    conNumero: boolean,
  ): string {
    const anio = d.hoy.slice(0, 4);
    const minusculas = d.tipoMovimiento.toLowerCase();
    const numero = conNumero
      ? `<br />Oficio preventivo núm. ${escapar(numeroOficio(d.folio, anio))}`
      : '';
    const encabezado =
      `<p class="encabezado">Toluca, Estado de México, ` +
      `${escapar(fechaLarga(d.fechaOficio))}${numero}</p>`;
    return this.plantillas.renderizar('oficio-preventivo', {
      encabezado,
      nombre: nombreMayusculas(
        d.servidor.nombre,
        d.servidor.primerApellido,
        d.servidor.segundoApellido,
      ),
      direccion: (d.servidor.direccion ?? '').toUpperCase(),
      dependencia: (d.servidor.dependencia ?? '').toUpperCase(),
      plazo: plazoPreventivo(d.tipoMovimientoId, minusculas),
      tipoMovimiento: minusculas,
      iniciales: d.iniciales,
    });
  }

  // ---- Generación de PDF + registro ----

  async generarRemision(
    dto: OficioOmisoDto,
    usuarioId: number,
  ): Promise<PdfGenerado> {
    const contexto = await this.cargarContexto(dto.declaracionId);
    const elabora = await this.servidorDelUsuario(usuarioId);
    const html = this.htmlRemision({
      ...contexto.datos,
      folio: dto.folio,
      iniciales: this.inicialesDe(elabora),
      hoy: hoyMexico(),
      folioDadp: dto.folioDadp,
      fechaOficio: dto.fechaOficio,
      fechaPadron: dto.fechaPadron,
      soporte: dto.soporte,
    });
    const buffer = await this.pdf.generar(html, {
      formato: 'letter',
      margenes: MARGENES_CARTA,
    });
    await this.registrarOficio(
      TIPO_CORREO_REMISION,
      contexto.servidorId,
      dto.declaracionId,
      dto.folio,
      elabora.id,
    );
    return {
      buffer,
      nombre: `oficio-remision-${this.parteDeNombre(dto.folio)}.pdf`,
    };
  }

  async generarPreventivo(
    dto: OficioPreventivoDto,
    usuarioId: number,
  ): Promise<PdfGenerado> {
    const contexto = await this.cargarContexto(dto.declaracionId);
    const elabora = await this.servidorDelUsuario(usuarioId);
    const html = this.htmlPreventivo({
      ...contexto.datos,
      folio: dto.folio,
      iniciales: this.inicialesDe(elabora),
      hoy: hoyMexico(),
      fechaOficio: dto.fechaOficio,
    });
    const buffer = await this.pdf.generar(html, {
      formato: 'letter',
      margenes: MARGENES_CARTA,
    });
    await this.registrarOficio(
      TIPO_CORREO_PREVENTIVO,
      contexto.servidorId,
      dto.declaracionId,
      dto.folio,
      elabora.id,
    );
    return {
      buffer,
      nombre: `oficio-preventivo-${this.parteDeNombre(dto.folio)}.pdf`,
    };
  }

  /**
   * Suma un oficio generado al registro de la declaración (servidor + tipo +
   * declaración) o lo crea.
   */
  async registrarOficio(
    tipoCorreo: number,
    servidorId: number,
    declaracionId: number,
    folio: string,
    idServidorRealizo: number,
  ): Promise<void> {
    const existente = await this.envioCorreoModel.findOne({
      where: { servidorPublicoId: servidorId, tipoCorreo, declaracionId },
    });
    if (existente) {
      await existente.update({
        totalOficiosGenerados: (existente.totalOficiosGenerados ?? 0) + 1,
        idServidorRealizo: String(idServidorRealizo),
      });
      return;
    }
    await this.envioCorreoModel.create({
      servidorPublicoId: servidorId,
      declaracionId,
      fechaEnvio: hoyMexico(),
      tipoCorreo,
      totalOficiosGenerados: 1,
      total: 0,
      noOficio: normalizarFolio(folio),
      idServidorRealizo: String(idServidorRealizo),
    });
  }

  // ---- Correo del oficio preventivo ----

  /** Ruta del PNG en assets/img o null si todavía no se ha puesto. */
  rutaImagenCorreo(nombre: string): string | null {
    const ruta = path.join(this.carpetaImagenes, nombre);
    return existsSync(ruta) ? ruta : null;
  }

  async enviarCorreoPreventivo(declaracionId: number): Promise<void> {
    const contexto = await this.cargarContexto(declaracionId);
    const usuario = await this.userModel.findOne({
      where: { servidorPublicoId: contexto.servidorId },
    });
    if (!usuario?.email) {
      throw new UnprocessableEntityException('Usuario no registrado.');
    }

    const adjuntos: { filename: string; path: string; cid: string }[] = [];
    let html = '';
    const encabezado = this.rutaImagenCorreo(IMAGEN_ENCABEZADO_CORREO);
    if (encabezado) {
      adjuntos.push({
        filename: IMAGEN_ENCABEZADO_CORREO,
        path: encabezado,
        cid: 'encabezado',
      });
      html +=
        '<p style="text-align:center"><img src="cid:encabezado" alt="" /></p>';
    } else {
      this.logger.warn(
        `Falta ${IMAGEN_ENCABEZADO_CORREO}: el correo va sin encabezado.`,
      );
    }

    const nombreCuerpo = [TIPO_MOV_INGRESO, TIPO_MOV_REINGRESO].includes(
      contexto.datos.tipoMovimientoId,
    )
      ? IMAGEN_CORREO_INICIAL
      : IMAGEN_CORREO_CONCLUSION;
    const cuerpo = this.rutaImagenCorreo(nombreCuerpo);
    if (cuerpo) {
      adjuntos.push({ filename: nombreCuerpo, path: cuerpo, cid: 'cuerpo' });
      html +=
        '<p style="text-align:center"><img src="cid:cuerpo" alt="Oficio preventivo" /></p>';
    } else {
      // Respaldo hasta que se agreguen los PNG: el texto del oficio preventivo.
      this.logger.warn(
        `Falta la imagen ${nombreCuerpo}: el correo usa el texto del oficio preventivo.`,
      );
      const previo = await this.envioCorreoModel.findOne({
        where: { declaracionId, tipoCorreo: TIPO_CORREO_PREVENTIVO },
        order: [['id', 'ASC']],
      });
      const hoy = hoyMexico();
      html += this.fragmentoPreventivo(
        {
          ...contexto.datos,
          folio: previo?.noOficio ?? '',
          iniciales: '',
          hoy,
          fechaOficio: hoy,
        },
        !!previo?.noOficio,
      );
    }

    await this.correo.enviar({
      para: usuario.email,
      asunto: ASUNTO_CORREO_PREVENTIVO,
      html,
      adjuntos,
    });

    // Igual que el viejo: id_servidor_realizo es el propio servidor destinatario.
    const existente = await this.envioCorreoModel.findOne({
      where: {
        servidorPublicoId: contexto.servidorId,
        tipoCorreo: TIPO_CORREO_PREVENTIVO,
        declaracionId,
      },
    });
    if (existente) {
      await existente.update({
        total: existente.total + 1,
        idServidorRealizo: String(contexto.servidorId),
      });
    } else {
      await this.envioCorreoModel.create({
        servidorPublicoId: contexto.servidorId,
        declaracionId,
        fechaEnvio: hoyMexico(),
        tipoCorreo: TIPO_CORREO_PREVENTIVO,
        total: 1,
        totalOficiosGenerados: 0,
        idServidorRealizo: String(contexto.servidorId),
      });
    }
  }

  // ---- Apoyo ----

  private async cargarContexto(declaracionId: number): Promise<{
    servidorId: number;
    datos: Omit<DatosOficio, 'folio' | 'iniciales' | 'hoy'>;
  }> {
    const declaracion = await this.declaracionModel.findByPk(declaracionId);
    if (!declaracion) throw new NotFoundException('Declaración no encontrada.');
    const [servidor, tipo] = await Promise.all([
      this.servidorModel.findByPk(declaracion.servidorPublicoId, {
        include: [TipoDependencia, TipoDireccion, TipoDepartamento],
      }),
      this.tipoMovimientoModel.findByPk(declaracion.tipoMovimientoId, {
        paranoid: false,
      }),
    ]);
    if (!servidor) {
      throw new NotFoundException('Servidor público no encontrado.');
    }
    return {
      servidorId: servidor.id,
      datos: {
        servidor: {
          nombre: servidor.nombre,
          primerApellido: servidor.primerApellido,
          segundoApellido: servidor.segundoApellido,
          cargo: servidor.cargo,
          dependencia: servidor.dependencia?.nombre ?? null,
          direccionId: servidor.tipoDireccionId,
          direccion: servidor.direccion?.nombre ?? null,
        },
        tipoMovimientoId: Number(declaracion.tipoMovimientoId),
        tipoMovimiento: tipo?.valor ?? '',
      },
    };
  }

  /** Servidor público del usuario con sesión (quien elabora el oficio). */
  private async servidorDelUsuario(
    usuarioId: number,
  ): Promise<ServidorPublico> {
    const usuario = await this.userModel.findByPk(usuarioId);
    const servidor = usuario
      ? await this.servidorModel.findByPk(usuario.servidorPublicoId)
      : null;
    if (!servidor) {
      throw new UnprocessableEntityException(
        'Tu usuario no tiene un servidor público asociado.',
      );
    }
    return servidor;
  }

  private inicialesDe(s: ServidorPublico): string {
    return inicialesDe(s.nombre, s.primerApellido, s.segundoApellido);
  }

  private parteDeNombre(folio: string): string {
    return normalizarFolio(folio).replace(/[^\w.-]+/g, '-') || 'sin-folio';
  }
}
