import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
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
  TIPO_MOV_INTERESES,
  TipoMovimientoMcg,
} from '../database/models/tipo-movimiento-mcg.model';
import { ColumnaExcel, ExcelService } from '../documentos/excel.service';
import { hoyMexico } from '../servidores/movimientos.reglas';
import { TipoReporteCorreo } from './dto/reportes.dto';
import { estatusOmisos, estatusPreventivo } from './plazos';

export interface FilaReporte {
  /** Id de la declaración. */
  id: number;
  servidorId: number;
  nombre: string;
  primerApellido: string;
  segundoApellido: string | null;
  curp: string | null;
  cargo: string;
  dependencia: string;
  direccion: string;
  departamento: string;
  tipoMovimientoId: number;
  tipoMovimiento: string;
  fechaDeclaracion: string;
  fechaEnvio: string | null;
  estatus: string;
}

const COLUMNAS_COMUNES_INICIO: ColumnaExcel[] = [
  { encabezado: 'NOMBRE', campo: 'nombre', ancho: 22 },
  { encabezado: 'APELLIDO PATERNO', campo: 'primerApellido', ancho: 20 },
  { encabezado: 'APELLIDO MATERNO', campo: 'segundoApellido', ancho: 20 },
  { encabezado: 'CURP', campo: 'curp', ancho: 22 },
  { encabezado: 'CARGO', campo: 'cargo', ancho: 30 },
  { encabezado: 'DEPENDENCIA', campo: 'dependencia', ancho: 36 },
  { encabezado: 'DIRECCION', campo: 'direccion', ancho: 36 },
  { encabezado: 'DEPARTAMENTO', campo: 'departamento', ancho: 36 },
  { encabezado: 'NIVEL CARGO', campo: 'nivelCargo', ancho: 12 },
  { encabezado: 'T. DE MOVIMIENTO', campo: 'tipoMovimiento', ancho: 22 },
  { encabezado: 'F. DE MOVIMIENTO', campo: 'fechaDeclaracion', ancho: 16 },
  { encabezado: 'ENVÍO', campo: 'envio', ancho: 24 },
  { encabezado: 'ESTADO DEL SP', campo: 'estadoSp', ancho: 16 },
];

const COLUMNAS_SOLO_PREVENTIVO: ColumnaExcel[] = [
  { encabezado: 'CORREO ENVIADO', campo: 'correoEnviado', ancho: 16 },
  { encabezado: 'TIPO DE CORREO', campo: 'tipoCorreo', ancho: 16 },
];

const COLUMNAS_COMUNES_FIN: ColumnaExcel[] = [
  { encabezado: 'OFICIOS GENERADOS', campo: 'oficiosGenerados', ancho: 18 },
  { encabezado: 'NO. OFICIO', campo: 'noOficio', ancho: 20 },
  { encabezado: 'FECHA DE ELABORACION', campo: 'fechaElaboracion', ancho: 22 },
];

/** Columnas del Excel de correos (correopreventivo.blade.php), en orden. */
export function columnasCorreo(tipo: TipoReporteCorreo): ColumnaExcel[] {
  return [
    ...COLUMNAS_COMUNES_INICIO,
    ...(tipo === 'PREVENTIVO' ? COLUMNAS_SOLO_PREVENTIVO : []),
    ...COLUMNAS_COMUNES_FIN,
  ];
}

const mayusculas = (valor: string | null | undefined): string =>
  (valor ?? '').toUpperCase();

@Injectable()
export class ReportesService {
  constructor(
    @InjectModel(ServidorPublico)
    private readonly servidorModel: typeof ServidorPublico,
    @InjectModel(TipoMovimientoMcg)
    private readonly tipoMovimientoModel: typeof TipoMovimientoMcg,
    @InjectModel(EnvioCorreo)
    private readonly envioCorreoModel: typeof EnvioCorreo,
    @InjectModel(Declaracion, 'declaranet')
    private readonly declaracionModel: typeof Declaracion,
    private readonly excel: ExcelService,
  ) {}

  /** Omisos y envíos extemporáneos con fecha de declaración en el rango (SelectOmisos). */
  async omisos(fechaInicio: string, fechaFin: string): Promise<FilaReporte[]> {
    const declaraciones = await this.declaracionModel.findAll({
      where: {
        obligado: { [Op.ne]: false },
        tipoMovimientoId: { [Op.ne]: TIPO_MOV_INTERESES },
        fechaDeclaracion: { [Op.between]: [fechaInicio, fechaFin] },
      },
      order: [['id', 'ASC']],
    });
    const hoy = hoyMexico();
    return this.filas(declaraciones, (d) =>
      estatusOmisos({
        tipoMovimientoId: Number(d.tipoMovimientoId),
        fechaDeclaracion: d.fechaDeclaracion,
        fechaEnvio: d.fechaEnvio,
        hoy,
      }),
    );
  }

  /** Declaraciones sin enviar y todavía dentro del plazo (SelectPreventivo). */
  async preventivos(): Promise<FilaReporte[]> {
    const declaraciones = await this.declaracionModel.findAll({
      where: {
        obligado: { [Op.ne]: false },
        tipoMovimientoId: { [Op.ne]: TIPO_MOV_INTERESES },
        // Solo las no enviadas pueden estar «EN TIEMPO»: recorta la consulta.
        fechaEnvio: null,
      },
      order: [['id', 'ASC']],
    });
    const hoy = hoyMexico();
    return this.filas(declaraciones, (d) =>
      estatusPreventivo({
        tipoMovimientoId: Number(d.tipoMovimientoId),
        fechaDeclaracion: d.fechaDeclaracion,
        fechaEnvio: d.fechaEnvio,
        hoy,
      }),
    );
  }

  /** Excel de los oficios/correos registrados en envio_correos (ReporteCorreo). */
  async excelCorreos(
    tipo: TipoReporteCorreo,
    fechaInicio: string,
    fechaFin: string,
  ): Promise<Buffer> {
    const correos = await this.envioCorreoModel.findAll({
      where: {
        tipoCorreo:
          tipo === 'PREVENTIVO' ? TIPO_CORREO_PREVENTIVO : TIPO_CORREO_REMISION,
        fechaEnvio: { [Op.between]: [fechaInicio, fechaFin] },
      },
      order: [['id', 'ASC']],
    });
    const [servidores, declaraciones, tipos] = await Promise.all([
      this.servidoresPorId(correos.map((c) => c.servidorPublicoId)),
      this.declaracionModel.findAll({
        where: { id: [...new Set(correos.map((c) => c.declaracionId))] },
      }),
      this.tipoMovimientoModel.findAll({ paranoid: false }),
    ]);
    const declaracionPorId = new Map(declaraciones.map((d) => [d.id, d]));
    const valorTipo = new Map(tipos.map((t) => [Number(t.id), t.valor]));

    const filas: Record<string, unknown>[] = [];
    for (const correo of correos) {
      const servidor = servidores.get(correo.servidorPublicoId);
      const declaracion = declaracionPorId.get(correo.declaracionId);
      // Igual que el viejo: sin servidor o declaración vigente no hay fila.
      if (!servidor || !declaracion) continue;
      filas.push({
        nombre: mayusculas(servidor.nombre),
        primerApellido: mayusculas(servidor.primerApellido),
        segundoApellido: mayusculas(servidor.segundoApellido),
        curp: mayusculas(servidor.curp),
        cargo: mayusculas(servidor.cargo),
        dependencia: mayusculas(servidor.dependencia?.nombre),
        direccion: mayusculas(servidor.direccion?.nombre),
        departamento: mayusculas(servidor.departamento?.nombre),
        nivelCargo: servidor.nivelCargo ?? '',
        tipoMovimiento:
          valorTipo.get(Number(declaracion.tipoMovimientoId)) ?? '',
        fechaDeclaracion: declaracion.fechaDeclaracion,
        envio: declaracion.fechaEnvio
          ? `ENVIADA EL: ${declaracion.fechaEnvio}`
          : 'SIN ENVIO',
        estadoSp: declaracion.obligado ? 'OBLIGADO' : 'NO OBLIGADO',
        correoEnviado: correo.total,
        tipoCorreo: tipo,
        oficiosGenerados: correo.totalOficiosGenerados,
        noOficio: correo.noOficio,
        fechaElaboracion: correo.fechaEnvio,
      });
    }
    return this.excel.generar('Correos', columnasCorreo(tipo), filas);
  }

  // ---- Apoyo ----

  private async servidoresPorId(
    ids: number[],
  ): Promise<Map<number, ServidorPublico>> {
    const unicos = [...new Set(ids.map(Number))];
    if (unicos.length === 0) return new Map();
    const servidores = await this.servidorModel.findAll({
      where: { id: unicos },
      include: [TipoDependencia, TipoDireccion, TipoDepartamento],
    });
    return new Map(servidores.map((s) => [Number(s.id), s]));
  }

  private async filas(
    declaraciones: Declaracion[],
    estatusDe: (d: Declaracion) => string | null,
  ): Promise<FilaReporte[]> {
    // Primero se filtra por estatus y después se piden servidores y tipos.
    const elegidas = declaraciones
      .map((d) => ({ d, estatus: estatusDe(d) }))
      .filter((x): x is { d: Declaracion; estatus: string } => !!x.estatus);
    if (elegidas.length === 0) return [];

    const [servidores, tipos] = await Promise.all([
      this.servidoresPorId(elegidas.map((x) => x.d.servidorPublicoId)),
      this.tipoMovimientoModel.findAll({ paranoid: false }),
    ]);
    const valorTipo = new Map(tipos.map((t) => [Number(t.id), t.valor]));

    const filas: FilaReporte[] = [];
    for (const { d, estatus } of elegidas) {
      const s = servidores.get(Number(d.servidorPublicoId));
      if (!s) continue;
      filas.push({
        id: Number(d.id),
        servidorId: Number(s.id),
        nombre: s.nombre,
        primerApellido: s.primerApellido,
        segundoApellido: s.segundoApellido,
        curp: s.curp,
        cargo: s.cargo,
        dependencia: s.dependencia?.nombre ?? '',
        direccion: s.direccion?.nombre ?? '',
        departamento: s.departamento?.nombre ?? '',
        tipoMovimientoId: Number(d.tipoMovimientoId),
        tipoMovimiento: valorTipo.get(Number(d.tipoMovimientoId)) ?? '',
        fechaDeclaracion: d.fechaDeclaracion,
        fechaEnvio: d.fechaEnvio,
        estatus,
      });
    }
    return filas;
  }
}
