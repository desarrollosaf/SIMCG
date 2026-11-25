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
import { Sequelize } from 'sequelize-typescript';
import { traducir } from '../common/filters/all-exceptions.filter';
import {
  Declaracion,
  ESTATUS_DECLARACION_INICIAL,
} from '../database/models/declaracion.model';
import { ServidorPublico } from '../database/models/servidor-publico.model';
import { CrearServidorDto } from '../servidores/dto/crear-servidor.dto';
import { ServidoresService } from '../servidores/servidores.service';
import type { ArchivoSubido } from '../common/archivo-subido';
import { generarCsv, leerCsv, parsearFecha } from './csv';

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
];

const OPCIONALES = [
  'segundo_apellido',
  'cve_issemym',
  'direccion_id',
  'departamento_id',
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

export interface FilaServidorAnalizada {
  renglon: number;
  curp: string | null;
  nombre: string | null;
  errores: string[];
  dto: CrearServidorDto | null;
}

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
      filas: filas.map(({ renglon, curp, nombre, errores }) => ({
        renglon,
        curp,
        nombre,
        errores,
      })),
    };
  }

  /**
   * Inserta solo los renglones válidos, todo o nada. Igual que el alta
   * individual (servidor en cddiputados con transacción, declaración inicial en
   * declaranet, commit al final), pero para el lote completo. Si algo falla
   * antes del commit se revierte el lote y se borran las declaraciones que ya
   * se hubieran creado en declaranet (compensación: MyISAM no tiene
   * transacciones).
   */
  async confirmar(archivo: ArchivoSubido | undefined, actorId: number) {
    const filas = await this.analizar(archivo);
    const validas = filas.filter((f) => f.errores.length === 0 && f.dto);
    if (validas.length === 0) {
      throw new BadRequestException('No hay renglones válidos para cargar');
    }

    const transaction = await this.sequelize.transaction();
    const idsServidores: number[] = [];
    let creoDeclaraciones = false;
    try {
      for (const fila of validas) {
        const dto = fila.dto!;
        // Se repite dentro de la transacción: otro usuario pudo dar de alta al
        // mismo servidor entre la previsualización y la confirmación.
        try {
          await this.servidoresService.validarDuplicados(
            dto,
            undefined,
            transaction,
          );
        } catch (error) {
          const mensaje = mensajeDe(error);
          if (error instanceof ConflictException && mensaje) {
            throw new ConflictException(
              `Renglón ${fila.renglon}: ${mensaje}. No se cargó nada; vuelve a previsualizar el archivo.`,
            );
          }
          throw error;
        }

        const servidor = await this.servidorModel.create(
          this.servidoresService.atributos(dto, {
            fechaInicio: dto.fechaInicio,
          }),
          { transaction },
        );
        idsServidores.push(servidor.id);
      }

      creoDeclaraciones = true;
      for (let i = 0; i < validas.length; i++) {
        const dto = validas[i].dto!;
        await this.declaracionModel.create({
          servidorPublicoId: idsServidores[i],
          tipoMovimientoId: dto.tipoMovimientoId,
          fechaDeclaracion: dto.fechaDeclaracion,
          estatusDeclaracionId: ESTATUS_DECLARACION_INICIAL,
          honorarios: dto.honorarios,
          cargo: dto.cargo,
          nivelCargo: dto.nivelCargo,
        });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback().catch(() => undefined);
      if (creoDeclaraciones && idsServidores.length > 0) {
        // Compensación: hay declaraciones en declaranet sin su servidor.
        await this.declaracionModel
          .destroy({
            where: { servidorPublicoId: idsServidores },
            force: true,
          })
          .catch((e: unknown) =>
            this.logger.error(
              `No se pudieron borrar las declaraciones huérfanas de la carga masiva: ${String(e)}`,
            ),
          );
      }
      throw error;
    }

    this.logger.log(
      `Usuario ${actorId} cargó ${validas.length} servidores por CSV`,
    );
    return {
      insertados: validas.length,
      omitidos: filas.length - validas.length,
    };
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
        const mensaje = await this.validarBaseDeDatos(fila.dto);
        if (mensaje) fila.errores.push(mensaje);
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
    };
  }

  // Mismas reglas del alta individual; devuelve el mensaje del primer error.
  private async validarBaseDeDatos(
    dto: CrearServidorDto,
  ): Promise<string | null> {
    try {
      await this.servidoresService.validarAlta(dto);
      await this.servidoresService.validarDuplicados(dto);
      return null;
    } catch (error) {
      const mensaje = mensajeDe(error);
      if (mensaje) return mensaje;
      throw error;
    }
  }
}

function propiedadDe(columna: string): string {
  return (
    Object.entries(COLUMNA_DE).find(([, c]) => c === columna)?.[0] ?? columna
  );
}
