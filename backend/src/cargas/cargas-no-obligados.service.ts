import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, fn, col, where as donde } from 'sequelize';
import {
  Declaracion,
  MOTIVO_NO_OBLIGADO_OTRO,
} from '../database/models/declaracion.model';
import { ServidorPublico } from '../database/models/servidor-publico.model';
import { TipoMovimientoMcg } from '../database/models/tipo-movimiento-mcg.model';
import type { ArchivoSubido } from '../common/archivo-subido';
import { generarCsv, leerCsv, parsearFecha } from './csv';

export const COLUMNAS_NO_OBLIGADOS = [
  'curp',
  'rfc',
  'tipo_movimiento',
  'fecha_movimiento',
];

const ALIAS = { fecha_de_movimiento: 'fecha_movimiento' };

const REGEX_CURP = /^[A-Z]{4}\d{6}[HMX][A-Z]{5}[A-Z\d]\d$/;
const REGEX_RFC = /^[A-ZÑ&]{4}\d{6}$/;

export type EstadoNoObligado = 'aplicar' | 'ya_no_obligado' | 'error';

export interface FilaNoObligadoAnalizada {
  renglon: number;
  curp: string | null;
  nombre: string | null;
  tipoMovimiento: string | null;
  fechaMovimiento: string | null;
  estado: EstadoNoObligado;
  errores: string[];
  // Declaraciones que se marcarían como no obligadas (solo estado 'aplicar').
  declaracionIds: number[];
}

const nombreCompleto = (s: ServidorPublico): string =>
  [s.nombre, s.primerApellido, s.segundoApellido].filter(Boolean).join(' ');

/**
 * Carga masiva de servidores que no están obligados a declarar. Replica la
 * importación del sistema anterior: ubica la declaración por servidor (CURP y
 * RFC), tipo de movimiento y fecha, y la marca como no obligada (motivo OTRO).
 */
@Injectable()
export class CargasNoObligadosService {
  private readonly logger = new Logger(CargasNoObligadosService.name);

  constructor(
    @InjectModel(ServidorPublico)
    private readonly servidorModel: typeof ServidorPublico,
    @InjectModel(TipoMovimientoMcg)
    private readonly tipoMovimientoModel: typeof TipoMovimientoMcg,
    @InjectModel(Declaracion, 'declaranet')
    private readonly declaracionModel: typeof Declaracion,
  ) {}

  layout(): Buffer {
    return generarCsv(COLUMNAS_NO_OBLIGADOS, [
      ['PELJ800101HMCRPN09', 'PELJ800101', '1', '15/01/2025'],
    ]);
  }

  async previsualizar(archivo: ArchivoSubido | undefined) {
    const filas = await this.analizar(archivo);
    const aplicables = filas.filter((f) => f.estado === 'aplicar').length;
    return {
      total: filas.length,
      aplicables,
      omitidos: filas.length - aplicables,
      filas: filas.map((f) => ({
        renglon: f.renglon,
        curp: f.curp,
        nombre: f.nombre,
        tipoMovimiento: f.tipoMovimiento,
        fechaMovimiento: f.fechaMovimiento,
        estado: f.estado,
        errores: f.errores,
      })),
    };
  }

  async confirmar(archivo: ArchivoSubido | undefined, actorId: number) {
    const filas = await this.analizar(archivo);
    const aplicables = filas.filter((f) => f.estado === 'aplicar');
    const ids = [...new Set(aplicables.flatMap((f) => f.declaracionIds))];
    if (ids.length === 0) {
      throw new BadRequestException('No hay renglones por aplicar');
    }

    // Una sola sentencia: declaraciones es MyISAM (sin transacciones).
    const [actualizados] = await this.declaracionModel.update(
      { obligado: false, motivoNoObligadoId: MOTIVO_NO_OBLIGADO_OTRO },
      { where: { id: { [Op.in]: ids } } },
    );

    this.logger.log(
      `Usuario ${actorId} marcó ${actualizados} declaraciones como no obligadas por CSV`,
    );
    return {
      actualizados,
      renglonesAplicados: aplicables.length,
      omitidos: filas.length - aplicables.length,
    };
  }

  async analizar(
    archivo: ArchivoSubido | undefined,
  ): Promise<FilaNoObligadoAnalizada[]> {
    const { filas } = leerCsv(archivo, {
      requeridas: COLUMNAS_NO_OBLIGADOS,
      alias: ALIAS,
    });

    // Fase 1: formato de cada renglón.
    const parciales = filas.map(({ renglon, valores: v }) => {
      const errores: string[] = [];
      const curp = v.curp.toUpperCase();
      const rfc = v.rfc.toUpperCase();
      if (!REGEX_CURP.test(curp))
        errores.push('La CURP no tiene un formato válido');
      if (!REGEX_RFC.test(rfc))
        errores.push('El RFC no tiene un formato válido');

      const tipo = /^\d+$/.test(v.tipo_movimiento)
        ? Number(v.tipo_movimiento)
        : NaN;
      if (!(tipo >= 1 && tipo <= 4)) {
        errores.push('El tipo de movimiento debe ser un número del 1 al 4');
      }
      const fecha = parsearFecha(v.fecha_movimiento);
      if (!fecha) {
        errores.push('La fecha del movimiento no es válida (usa dd/mm/aaaa)');
      }
      return {
        renglon,
        curp,
        rfc,
        tipo: tipo >= 1 && tipo <= 4 ? tipo : null,
        fecha,
        errores,
      };
    });

    // Fase 2: una consulta para servidores, otra para declaraciones y otra para
    // el catálogo (en vez de una por renglón).
    const curps = [
      ...new Set(
        parciales.filter((p) => REGEX_CURP.test(p.curp)).map((p) => p.curp),
      ),
    ];
    const servidores = curps.length
      ? await this.servidorModel.findAll({
          where: donde(fn('TRIM', col('curp')), { [Op.in]: curps }),
        })
      : [];
    const servidoresPorLlave = new Map<string, ServidorPublico[]>();
    for (const s of servidores) {
      const llave = `${(s.curp ?? '').trim().toUpperCase()}|${(s.rfc ?? '').trim().toUpperCase()}`;
      servidoresPorLlave.set(llave, [
        ...(servidoresPorLlave.get(llave) ?? []),
        s,
      ]);
    }

    const idsServidores = servidores.map((s) => s.id);
    const declaraciones = idsServidores.length
      ? await this.declaracionModel.findAll({
          where: {
            servidorPublicoId: { [Op.in]: idsServidores },
            tipoMovimientoId: { [Op.in]: [1, 2, 3, 4] },
          },
        })
      : [];

    const tipos = await this.tipoMovimientoModel.findAll();
    const nombreTipo = new Map(tipos.map((t) => [Number(t.id), t.valor]));

    // Fase 3: resolver cada renglón.
    const vistos = new Map<string, number>();
    return parciales.map((p) => {
      const base = {
        renglon: p.renglon,
        curp: p.curp || null,
        nombre: null as string | null,
        tipoMovimiento: p.tipo ? (nombreTipo.get(p.tipo) ?? null) : null,
        fechaMovimiento: p.fecha,
        declaracionIds: [] as number[],
      };
      const falla = (errores: string[]): FilaNoObligadoAnalizada => ({
        ...base,
        estado: 'error',
        errores,
      });

      if (p.errores.length > 0) return falla(p.errores);

      const llave = `${p.curp}|${p.rfc}|${p.tipo}|${p.fecha}`;
      const previo = vistos.get(llave);
      if (previo !== undefined) {
        return falla([`Repetido en el renglón ${previo}`]);
      }
      vistos.set(llave, p.renglon);

      const encontrados = servidoresPorLlave.get(`${p.curp}|${p.rfc}`) ?? [];
      if (encontrados.length === 0) {
        return falla(['Servidor público no encontrado con esa CURP y RFC']);
      }
      base.nombre = nombreCompleto(encontrados[0]);

      const idsEncontrados = new Set(encontrados.map((s) => Number(s.id)));
      const coincidentes = declaraciones.filter(
        (d) =>
          idsEncontrados.has(Number(d.servidorPublicoId)) &&
          Number(d.tipoMovimientoId) === p.tipo &&
          d.fechaDeclaracion === p.fecha,
      );
      if (coincidentes.length === 0) {
        return falla([
          'No se encontró la declaración con ese movimiento y fecha',
        ]);
      }

      const pendientes = coincidentes.filter((d) => !!d.obligado);
      if (pendientes.length === 0) {
        return { ...base, estado: 'ya_no_obligado', errores: [] };
      }
      return {
        ...base,
        estado: 'aplicar',
        errores: [],
        declaracionIds: pendientes.map((d) => Number(d.id)),
      };
    });
  }
}
