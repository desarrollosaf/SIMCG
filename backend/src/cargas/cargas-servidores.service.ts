import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Op, Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { traducir } from '../common/filters/all-exceptions.filter';
import {
  Declaracion,
  ESTATUS_DECLARACION_INICIAL,
  MOTIVO_NO_OBLIGADO_OTRO,
} from '../database/models/declaracion.model';
import { ServidorPublico } from '../database/models/servidor-publico.model';
import { TIPO_MOV_INTERESES } from '../database/models/tipo-movimiento-mcg.model';
import { CrearServidorDto } from '../servidores/dto/crear-servidor.dto';
import { ServidoresService } from '../servidores/servidores.service';
import type { ArchivoSubido } from '../common/archivo-subido';
import { generarCsv, leerCsv, parsearFecha } from './csv';
import {
  FilasCreadas,
  copiarArbolDeclaracion,
  deshacerCopia,
} from './copiar-declaracion';

export const COLUMNAS_SERVIDORES = [
  'nombre',
  'primer_apellido',
  'segundo_apellido',
  'curp',
  'rfc',
  'homoclave',
  'fecha_inicio',
  'cargo',
  'nivel_cargo',
  'cve_issemym',
  'dependencia_id',
  'direccion_id',
  'departamento_id',
  'honorarios',
  'tipo_movimiento',
  'fecha_movimiento',
  'obligado',
];

const OPCIONALES = [
  'segundo_apellido',
  'cve_issemym',
  'direccion_id',
  'departamento_id',
  'obligado',
];
const REQUERIDAS = COLUMNAS_SERVIDORES.filter((c) => !OPCIONALES.includes(c));

// Nombres con los que el sistema anterior llamaba a algunas columnas.
const ALIAS = {
  homcve: 'homoclave',
  nivel_empleo: 'nivel_cargo',
  fecha_de_inicio: 'fecha_inicio',
  fecha_de_movimiento: 'fecha_movimiento',
};

// Propiedad del DTO -> columna del CSV (para hablarle al usuario en sus términos).
const COLUMNA_DE: Record<string, string> = {
  nombre: 'nombre',
  primerApellido: 'primer_apellido',
  segundoApellido: 'segundo_apellido',
  curp: 'curp',
  rfc: 'rfc',
  homoclave: 'homoclave',
  fechaInicio: 'fecha_inicio',
  cargo: 'cargo',
  nivelCargo: 'nivel_cargo',
  cveIssemym: 'cve_issemym',
  tipoDependenciaId: 'dependencia_id',
  tipoDireccionId: 'direccion_id',
  tipoDepartamentoId: 'departamento_id',
  honorarios: 'honorarios',
  tipoMovimientoId: 'tipo_movimiento',
  fechaDeclaracion: 'fecha_movimiento',
};

// alta = servidor nuevo; movimiento = ya existía (CURP y RFC) y recibe un movimiento nuevo.
export type AccionFila = 'alta' | 'movimiento';

export interface FilaServidorAnalizada {
  renglon: number;
  curp: string | null;
  nombre: string | null;
  errores: string[];
  dto: CrearServidorDto | null;
  // Como el sistema anterior: solo el valor 1 marca al servidor como NO obligado.
  obligado: boolean;
  accion: AccionFila | null;
}

// Campos escalares que un movimiento nuevo hereda de la declaración anterior.
const CAMPOS_HEREDADOS = [
  'correoInstitucional',
  'correoPersonal',
  'telefonoCasa',
  'telefonoPersonal',
  'situacionPersonalId',
  'regimenMatrimonialId',
  'honorarios',
  'paisId',
  'nacionalidad',
  'nacionalidadId',
  'regimenEspecificar',
  'observaciones',
  'regimenMatrimonial',
] as const;

type Busqueda =
  { servidor: ServidorPublico } | { servidor: null; error: string | null };

const vacioANulo = (v: string): string | null => (v === '' ? null : v);

// Convierte la excepción de una validación de BD en el texto de su error.
function mensajeDe(error: unknown): string | null {
  if (!(error instanceof HttpException)) return null;
  const cuerpo = error.getResponse();
  if (typeof cuerpo === 'string') return cuerpo;
  const mensaje = (cuerpo as { message?: unknown }).message;
  return Array.isArray(mensaje) ? mensaje.join(', ') : String(mensaje);
}

@Injectable()
export class CargasServidoresService {
  private readonly logger = new Logger(CargasServidoresService.name);

  constructor(
    @InjectConnection() private readonly sequelize: Sequelize,
    @InjectModel(ServidorPublico)
    private readonly servidorModel: typeof ServidorPublico,
    @InjectModel(Declaracion, 'declaranet')
    private readonly declaracionModel: typeof Declaracion,
    private readonly servidoresService: ServidoresService,
  ) {}

  layout(): Buffer {
    return generarCsv(COLUMNAS_SERVIDORES, [
      [
        'JUAN',
        'PEREZ',
        'LOPEZ',
        'PELJ800101HMCRPN09',
        'PELJ800101',
        'AB1',
        '01/01/2025',
        'ANALISTA',
        '25-1',
        '1234567',
        '1',
        '',
        '',
        'NO',
        '1',
        '15/01/2025',
        '',
      ],
    ]);
  }

  async previsualizar(archivo: ArchivoSubido | undefined) {
    const filas = await this.analizar(archivo);
    const conErrores = filas.filter((f) => f.errores.length > 0).length;
    return {
      total: filas.length,
      validas: filas.length - conErrores,
      conErrores,
      filas: filas.map(({ renglon, curp, nombre, errores, accion }) => ({
        renglon,
        curp,
        nombre,
        errores,
        accion,
      })),
    };
  }

  /**
   * Procesa solo los renglones válidos, uno por uno (como el sistema anterior):
   * servidor nuevo -> alta con su primera declaración; servidor existente ->
   * actualiza su cargo/adscripción y crea una declaración nueva con los datos
   * copiados de la anterior. Cada renglón va en su propia transacción; si falla
   * se revierte y se reporta en `fallidos` sin detener los demás.
   */
  async confirmar(archivo: ArchivoSubido | undefined, actorId: number) {
    const filas = await this.analizar(archivo);
    const validas = filas.filter((f) => f.errores.length === 0 && f.dto);
    if (validas.length === 0) {
      throw new BadRequestException('No hay renglones válidos para cargar');
    }

    let nuevos = 0;
    let actualizados = 0;
    const fallidos: { renglon: number; mensaje: string }[] = [];
    for (const fila of validas) {
      try {
        const accion = await this.procesarFila(fila);
        if (accion === 'alta') nuevos++;
        else actualizados++;
      } catch (error) {
        const mensaje = mensajeDe(error);
        if (!mensaje) {
          this.logger.error(
            `Renglón ${fila.renglon} de la carga de servidores: ${String(error)}`,
          );
        }
        fallidos.push({
          renglon: fila.renglon,
          mensaje: mensaje ?? 'Error inesperado al guardar el renglón',
        });
      }
    }

    this.logger.log(
      `Usuario ${actorId} cargó servidores por CSV: ${nuevos} altas, ${actualizados} movimientos, ${fallidos.length} fallidos`,
    );
    const insertados = nuevos + actualizados;
    return {
      insertados,
      nuevos,
      actualizados,
      omitidos: filas.length - insertados,
      fallidos,
    };
  }

  // Un renglón completo: servidor (cddiputados, transacción) + declaración y su
  // árbol (declaranet, MyISAM: sin transacciones, se compensa a mano).
  private async procesarFila(fila: FilaServidorAnalizada): Promise<AccionFila> {
    const dto = fila.dto!;
    const transaction = await this.sequelize.transaction();
    const creadas: FilasCreadas = new Map();
    let declaracion: Declaracion | null = null;
    try {
      // Se repite dentro de la transacción: el servidor pudo cambiar desde la previsualización.
      const busqueda = await this.buscarServidor(dto, transaction);
      if (!busqueda.servidor && busqueda.error) {
        throw new ConflictException(busqueda.error);
      }

      const estado = {
        obligado: fila.obligado,
        motivoNoObligadoId: fila.obligado ? null : MOTIVO_NO_OBLIGADO_OTRO,
      };
      let accion: AccionFila;
      if (busqueda.servidor) {
        accion = 'movimiento';
        const servidor = busqueda.servidor;
        const previa = await this.declaracionModel.findOne({
          where: {
            servidorPublicoId: servidor.id,
            tipoMovimientoId: { [Op.ne]: TIPO_MOV_INTERESES },
          },
          order: [['id', 'DESC']],
        });
        await servidor.update(
          {
            nivelCargo: dto.nivelCargo,
            cargo: dto.cargo,
            cveIssemym: dto.cveIssemym ?? null,
            tipoDependenciaId: dto.tipoDependenciaId,
            tipoDireccionId: dto.tipoDireccionId ?? null,
            tipoDepartamentoId: dto.tipoDepartamentoId ?? null,
          },
          { transaction },
        );

        const heredados: Record<string, unknown> = {};
        if (previa) {
          for (const campo of CAMPOS_HEREDADOS)
            heredados[campo] = previa[campo];
        } else {
          heredados.honorarios = servidor.honorarios;
        }
        declaracion = await this.declaracionModel.create({
          ...heredados,
          servidorPublicoId: servidor.id,
          tipoMovimientoId: dto.tipoMovimientoId,
          fechaDeclaracion: dto.fechaDeclaracion,
          estatusDeclaracionId: ESTATUS_DECLARACION_INICIAL,
          ...estado,
          cargo: dto.cargo,
          nivelCargo: dto.nivelCargo,
        });
        if (previa) {
          await copiarArbolDeclaracion(
            this.conexionDeclaranet(),
            previa.id,
            declaracion.id,
            creadas,
          );
        }
      } else {
        accion = 'alta';
        const servidor = await this.servidorModel.create(
          this.servidoresService.atributos(dto, {
            fechaInicio: dto.fechaInicio,
          }),
          { transaction },
        );
        declaracion = await this.declaracionModel.create({
          servidorPublicoId: servidor.id,
          tipoMovimientoId: dto.tipoMovimientoId,
          fechaDeclaracion: dto.fechaDeclaracion,
          estatusDeclaracionId: ESTATUS_DECLARACION_INICIAL,
          honorarios: dto.honorarios,
          ...estado,
          cargo: dto.cargo,
          nivelCargo: dto.nivelCargo,
        });
      }

      await transaction.commit();
      return accion;
    } catch (error) {
      await transaction.rollback().catch(() => undefined);
      // Compensación: lo creado en declaranet no tiene transacción que lo respalde.
      await deshacerCopia(this.conexionDeclaranet(), creadas).catch(
        (e: unknown) =>
          this.logger.error(
            `No se pudo deshacer la copia de la declaración del renglón ${fila.renglon}: ${String(e)}`,
          ),
      );
      if (declaracion) {
        const huerfana = declaracion;
        await huerfana
          .destroy({ force: true })
          .catch((e: unknown) =>
            this.logger.error(
              `No se pudo borrar la declaración ${huerfana.id} huérfana: ${String(e)}`,
            ),
          );
      }
      throw error;
    }
  }

  private conexionDeclaranet(): Sequelize {
    return this.declaracionModel.sequelize as Sequelize;
  }

  // Busca por CURP y RFC. Si solo coincide uno de los dos es un conflicto de datos.
  private async buscarServidor(
    dto: CrearServidorDto,
    transaction?: Transaction,
  ): Promise<Busqueda> {
    const candidatos = await this.servidorModel.findAll({
      where: { [Op.or]: [{ curp: dto.curp }, { rfc: dto.rfc }] },
      transaction,
    });
    const igual = (a: string | null, b: string) =>
      (a ?? '').toUpperCase() === b.toUpperCase();

    const servidor = candidatos.find(
      (s) => igual(s.curp, dto.curp) && igual(s.rfc, dto.rfc),
    );
    if (servidor) return { servidor };

    const porCurp = candidatos.find((s) => igual(s.curp, dto.curp));
    if (porCurp) {
      return {
        servidor: null,
        error: `La CURP ya existe con otro RFC (${porCurp.rfc ?? 'sin RFC'}); no coincide con el RFC ${dto.rfc}`,
      };
    }
    const porRfc = candidatos.find((s) => igual(s.rfc, dto.rfc));
    if (porRfc) {
      return {
        servidor: null,
        error: `El RFC ya existe con otra CURP (${porRfc.curp ?? 'sin CURP'}); no coincide con la CURP ${dto.curp}`,
      };
    }
    return { servidor: null, error: null };
  }

  // Lee el CSV y valida todos los renglones (formato, repetidos y base de datos).
  async analizar(
    archivo: ArchivoSubido | undefined,
  ): Promise<FilaServidorAnalizada[]> {
    const { filas } = leerCsv(archivo, {
      requeridas: REQUERIDAS,
      opcionales: OPCIONALES,
      alias: ALIAS,
    });

    const porCurp = new Map<string, number>();
    const porRfc = new Map<string, number>();
    const resultado: FilaServidorAnalizada[] = [];

    for (const { renglon, valores } of filas) {
      const fila = await this.analizarFila(renglon, valores);

      if (fila.errores.length === 0 && fila.dto) {
        const { curp, rfc, homoclave } = fila.dto;
        const llaveRfc = `${rfc}|${homoclave}`;
        const repetido = porCurp.get(curp) ?? porRfc.get(llaveRfc);
        if (repetido !== undefined) {
          fila.errores.push(`Repetido en el renglón ${repetido}`);
        } else {
          porCurp.set(curp, renglon);
          porRfc.set(llaveRfc, renglon);
        }
      }

      if (fila.errores.length === 0 && fila.dto) {
        const { error, accion } = await this.validarBaseDeDatos(fila.dto);
        if (error) fila.errores.push(error);
        else fila.accion = accion;
      }
      resultado.push(fila);
    }
    return resultado;
  }

  private async analizarFila(
    renglon: number,
    v: Record<string, string>,
  ): Promise<FilaServidorAnalizada> {
    const errores: string[] = [];
    // Propiedades cuyo error ya se explicó aquí (no repetir el del validador).
    const omitir = new Set<string>();

    for (const columna of REQUERIDAS) {
      if (v[columna] === '') {
        errores.push(`Falta el dato "${columna}"`);
        omitir.add(propiedadDe(columna));
      }
    }

    const fecha = (columna: string, etiqueta: string): string | undefined => {
      if (v[columna] === '') return undefined;
      const fecha = parsearFecha(v[columna]);
      if (!fecha) {
        errores.push(`${etiqueta} no es válida (usa dd/mm/aaaa)`);
        omitir.add(propiedadDe(columna));
        return undefined;
      }
      return fecha;
    };
    const fechaInicio = fecha('fecha_inicio', 'La fecha de inicio');
    const fechaDeclaracion = fecha(
      'fecha_movimiento',
      'La fecha del movimiento',
    );

    let honorarios: number | undefined;
    if (v.honorarios !== '') {
      const clave = v.honorarios
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toUpperCase();
      if (clave === '1' || clave === 'SI') honorarios = 1;
      else if (clave === '2' || clave === 'NO') honorarios = 2;
      else {
        errores.push('Honorarios debe ser 1, 2, SI o NO');
        omitir.add('honorarios');
      }
    }

    const plano = {
      nombre: v.nombre,
      primerApellido: v.primer_apellido,
      segundoApellido: vacioANulo(v.segundo_apellido ?? ''),
      curp: v.curp,
      rfc: v.rfc,
      homoclave: v.homoclave,
      fechaInicio,
      cargo: v.cargo,
      nivelCargo: v.nivel_cargo,
      cveIssemym: vacioANulo(v.cve_issemym ?? ''),
      tipoDependenciaId: v.dependencia_id,
      tipoDireccionId: vacioANulo(v.direccion_id ?? ''),
      tipoDepartamentoId: vacioANulo(v.departamento_id ?? ''),
      honorarios,
      tipoMovimientoId: v.tipo_movimiento,
      fechaDeclaracion,
    };
    const dto = plainToInstance(CrearServidorDto, plano);
    const fallas = await validate(dto, { whitelist: true });
    for (const falla of fallas) {
      if (omitir.has(falla.property)) continue;
      const columna = COLUMNA_DE[falla.property] ?? falla.property;
      for (const mensaje of Object.values(falla.constraints ?? {})) {
        const texto = traducir(mensaje).replace(
          new RegExp(`\\b${falla.property}\\b`, 'g'),
          columna,
        );
        if (!errores.includes(texto)) errores.push(texto);
      }
    }

    const nombre =
      [v.nombre, v.primer_apellido, v.segundo_apellido]
        .filter(Boolean)
        .join(' ')
        .toUpperCase() || null;
    return {
      renglon,
      curp: v.curp ? v.curp.toUpperCase() : null,
      nombre,
      errores,
      dto: errores.length === 0 ? dto : null,
      // Igual que el sistema anterior: 1 = no obligado; vacío u otro valor = obligado.
      obligado: (v.obligado ?? '') !== '1',
      accion: null,
    };
  }

  // Reglas del alta (adscripción, honorarios, tipo de movimiento) y búsqueda por CURP y RFC.
  private async validarBaseDeDatos(
    dto: CrearServidorDto,
  ): Promise<{ error: string | null; accion: AccionFila | null }> {
    try {
      await this.servidoresService.validarAlta(dto);
      const busqueda = await this.buscarServidor(dto);
      if (busqueda.servidor) return { error: null, accion: 'movimiento' };
      if (busqueda.error) return { error: busqueda.error, accion: null };
      return { error: null, accion: 'alta' };
    } catch (error) {
      const mensaje = mensajeDe(error);
      if (mensaje) return { error: mensaje, accion: null };
      throw error;
    }
  }
}

function propiedadDe(columna: string): string {
  return (
    Object.entries(COLUMNA_DE).find(([, c]) => c === columna)?.[0] ?? columna
  );
}
