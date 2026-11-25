import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { createReadStream } from 'fs';
import { access, mkdir, stat, unlink, writeFile } from 'fs/promises';
import * as path from 'path';
import {
  Op,
  QueryTypes,
  UniqueConstraintError,
  WhereOptions,
  literal,
} from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import type { ArchivoSubido } from '../common/archivo-subido';
import { Declaracion } from '../database/models/declaracion.model';
import { Libro } from '../database/models/libro.model';
import { ServidorPublico } from '../database/models/servidor-publico.model';
import { TipoDependencia } from '../database/models/tipo-dependencia.model';
import { TipoDireccion } from '../database/models/tipo-direccion.model';
import {
  TIPO_MOV_CONCLUSION,
  TIPO_MOV_INGRESO,
  TIPO_MOV_MODIFICACION,
  TIPO_MOV_REINGRESO,
  TipoMovimientoMcg,
} from '../database/models/tipo-movimiento-mcg.model';
import {
  ListarDeclaracionesLibroDto,
  SubirActaDto,
  TIPOS_LIBRO,
  TipoLibro,
} from './dto/libros.dto';

// Tipos de movimiento que muestra cada pestaña. El inicial incluye el reingreso.
const TIPOS_DE_PESTANA: Record<TipoLibro, number[]> = {
  inicial: [TIPO_MOV_INGRESO, TIPO_MOV_REINGRESO],
  modificacion: [TIPO_MOV_MODIFICACION],
  conclusion: [TIPO_MOV_CONCLUSION],
};

// Tipo de movimiento con el que se guarda el acta de cada libro.
const TIPO_DE_ACTA: Record<TipoLibro, number> = {
  inicial: TIPO_MOV_INGRESO,
  modificacion: TIPO_MOV_MODIFICACION,
  conclusion: TIPO_MOV_CONCLUSION,
};

const MAX_BYTES_ACTA = 15 * 1024 * 1024;

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

// Escapa los comodines de LIKE para que la búsqueda sea literal.
const escaparLike = (texto: string): string =>
  texto.replace(/[\\%_]/g, (c) => `\\${c}`);

const nombreCompleto = (s: ServidorPublico): string =>
  [s.nombre, s.primerApellido, s.segundoApellido].filter(Boolean).join(' ');

// Tipo de archivo según sus primeros bytes (no se confía en el nombre).
function extensionPorContenido(buffer: Buffer): 'pdf' | 'tif' | null {
  if (
    buffer.length >= 4 &&
    buffer.subarray(0, 4).toString('latin1') === '%PDF'
  ) {
    return 'pdf';
  }
  const cabecera = buffer.subarray(0, 4).toString('hex');
  if (cabecera === '49492a00' || cabecera === '4d4d002a') return 'tif';
  return null;
}

export interface ResumenTipo {
  total: number;
  fiscal: number;
  aclaraciones: number;
}

@Injectable()
export class LibrosService {
  private readonly logger = new Logger(LibrosService.name);

  constructor(
    @InjectConnection() private readonly sequelize: Sequelize,
    @InjectConnection('declaranet')
    private readonly sequelizeDeclaranet: Sequelize,
    @InjectModel(ServidorPublico)
    private readonly servidorModel: typeof ServidorPublico,
    @InjectModel(Libro) private readonly libroModel: typeof Libro,
    @InjectModel(TipoMovimientoMcg)
    private readonly tipoMovimientoModel: typeof TipoMovimientoMcg,
    @InjectModel(Declaracion, 'declaranet')
    private readonly declaracionModel: typeof Declaracion,
    private readonly config: ConfigService,
  ) {}

  private get directorio(): string {
    return this.config.get<string>('archivos.dir') ?? '/app/uploads';
  }

  // Ruta absoluta de un archivo guardado; null si se sale de ARCHIVOS_DIR.
  private resolverRuta(ruta: string): string | null {
    const base = path.resolve(this.directorio);
    const completa = path.resolve(base, ruta);
    const relativa = path.relative(base, completa);
    if (
      relativa === '' ||
      relativa.startsWith('..') ||
      path.isAbsolute(relativa)
    ) {
      return null;
    }
    return completa;
  }

  private async existe(ruta: string | null | undefined): Promise<boolean> {
    if (!ruta) return false;
    const completa = this.resolverRuta(ruta);
    if (!completa) return false;
    try {
      return (await stat(completa)).isFile();
    } catch {
      return false;
    }
  }

  async anios(): Promise<number[]> {
    const enviadas = await this.sequelizeDeclaranet.query<{ anio: number }>(
      `SELECT DISTINCT YEAR(fecha_envio) AS anio FROM declaraciones
        WHERE deleted_at IS NULL AND obligado <> 0 AND fecha_envio IS NOT NULL`,
      { type: QueryTypes.SELECT },
    );
    const libros = await this.libroModel.findAll({
      attributes: ['anio'],
      group: ['anio'],
    });

    const anios = new Set<number>([new Date().getFullYear()]);
    for (const { anio } of enviadas) {
      if (anio) anios.add(Number(anio));
    }
    for (const libro of libros) {
      const anio = Number(libro.anio);
      if (Number.isInteger(anio) && anio > 0) anios.add(anio);
    }
    return [...anios].sort((a, b) => b - a);
  }

  async resumen(anio: number) {
    const filas = await this.sequelizeDeclaranet.query<{
      tipo: number;
      total: string | number;
      fiscal: string | number | null;
      aclaraciones: string | number | null;
    }>(
      `SELECT d.tipo_movimiento_id AS tipo,
              COUNT(*) AS total,
              SUM(EXISTS(SELECT 1 FROM documento_sats s
                          WHERE s.declaracion_id = d.id
                            AND s.requiere_cargar_evidencia = 1)) AS fiscal,
              SUM(d.fecha_envio_aclaracion IS NOT NULL) AS aclaraciones
         FROM declaraciones d
        WHERE d.deleted_at IS NULL AND d.obligado <> 0
          AND d.fecha_envio >= :desde AND d.fecha_envio < :hasta
          AND d.tipo_movimiento_id IN (:tipos)
        GROUP BY d.tipo_movimiento_id`,
      {
        type: QueryTypes.SELECT,
        replacements: {
          desde: `${anio}-01-01`,
          hasta: `${anio + 1}-01-01`,
          tipos: Object.values(TIPOS_DE_PESTANA).flat(),
        },
      },
    );

    const resultado: Record<TipoLibro, ResumenTipo> = {
      inicial: { total: 0, fiscal: 0, aclaraciones: 0 },
      modificacion: { total: 0, fiscal: 0, aclaraciones: 0 },
      conclusion: { total: 0, fiscal: 0, aclaraciones: 0 },
    };
    for (const fila of filas) {
      const tipo = TIPOS_LIBRO.find((t) =>
        TIPOS_DE_PESTANA[t].includes(Number(fila.tipo)),
      );
      if (!tipo) continue;
      resultado[tipo].total += Number(fila.total);
      resultado[tipo].fiscal += Number(fila.fiscal ?? 0);
      resultado[tipo].aclaraciones += Number(fila.aclaraciones ?? 0);
    }
    return { anio, ...resultado };
  }

  async declaraciones(dto: ListarDeclaracionesLibroDto) {
    const where: WhereOptions[] = [
      { tipoMovimientoId: { [Op.in]: TIPOS_DE_PESTANA[dto.tipo] } },
      literal('`Declaracion`.`obligado` <> 0'),
      {
        fechaEnvio: {
          [Op.gte]: `${dto.anio}-01-01`,
          [Op.lt]: `${dto.anio + 1}-01-01`,
        },
      },
    ];

    const palabras = (dto.buscar ?? '').split(/\s+/).filter(Boolean);
    if (palabras.length > 0) {
      // Los servidores viven en otra base: primero se buscan sus ids.
      const encontrados = await this.servidorModel.findAll({
        attributes: ['id'],
        paranoid: false,
        where: {
          [Op.and]: palabras.map((palabra) => {
            const like = { [Op.like]: `%${escaparLike(palabra)}%` };
            return {
              [Op.or]: [
                { nombre: like },
                { primerApellido: like },
                { segundoApellido: like },
                { curp: like },
              ],
            };
          }),
        },
      });
      if (encontrados.length === 0) return { total: 0, filas: [] };
      where.push({
        servidorPublicoId: { [Op.in]: encontrados.map((s) => s.id) },
      });
    }

    const { count, rows } = await this.declaracionModel.findAndCountAll({
      where: { [Op.and]: where },
      order: [
        ['fechaEnvio', 'DESC'],
        ['id', 'DESC'],
      ],
      offset: dto.inicio ?? 0,
      limit: dto.limite ?? 10,
    });

    const ids = [...new Set(rows.map((d) => d.servidorPublicoId))];
    const servidores = ids.length
      ? await this.servidorModel.findAll({
          where: { id: { [Op.in]: ids } },
          paranoid: false,
          include: [
            { model: TipoDependencia, as: 'dependencia', paranoid: false },
            { model: TipoDireccion, as: 'direccion', paranoid: false },
          ],
        })
      : [];
    const porId = new Map(servidores.map((s) => [Number(s.id), s]));
    const nombresTipo = await this.nombresTipoMovimiento(
      rows.map((d) => Number(d.tipoMovimientoId)),
    );

    return {
      total: count,
      filas: rows.map((d) => {
        const s = porId.get(Number(d.servidorPublicoId));
        return {
          id: d.id,
          servidorId: d.servidorPublicoId,
          nombre: s ? nombreCompleto(s) : null,
          cargo: (d.cargo ?? s?.cargo ?? '').trim() || null,
          curp: s?.curp?.trim() ?? null,
          dependencia: s?.dependencia?.nombre ?? null,
          direccion: s?.direccion?.nombre ?? null,
          tipoMovimiento: nombresTipo.get(Number(d.tipoMovimientoId)) ?? null,
          fechaEnvio: d.fechaEnvio,
        };
      }),
    };
  }

  private async nombresTipoMovimiento(
    ids: number[],
  ): Promise<Map<number, string>> {
    const unicos = [...new Set(ids)];
    if (unicos.length === 0) return new Map();
    const tipos = await this.tipoMovimientoModel.findAll({
      where: { id: { [Op.in]: unicos } },
    });
    return new Map(tipos.map((t) => [Number(t.id), t.valor]));
  }

  // ---------------------------------------------------------------- actas

  async actas(anio: number) {
    const libros = await this.libroModel.findAll({
      where: {
        anio: String(anio),
        tipoMovimientoId: { [Op.in]: Object.values(TIPO_DE_ACTA) },
      },
      order: [['id', 'ASC']],
    });
    // Si hubiera repetidos (la BD vieja no tenía índice único) manda el más nuevo.
    return Promise.all(
      TIPOS_LIBRO.map((tipo) => {
        const libro =
          [...libros]
            .reverse()
            .find((l) => Number(l.tipoMovimientoId) === TIPO_DE_ACTA[tipo]) ??
          null;
        return this.filaActa(tipo, anio, libro);
      }),
    );
  }

  private async filaActa(tipo: TipoLibro, anio: number, libro: Libro | null) {
    const tieneActa = await this.existe(libro?.ruta);
    return {
      tipo,
      tipoMovimientoId: TIPO_DE_ACTA[tipo],
      id: libro ? Number(libro.id) : null,
      anio,
      tieneActa,
      nombreActa: tieneActa && libro ? path.basename(libro.ruta) : null,
      tieneSoporte: await this.existe(libro?.rutaSoporte),
      actualizado: libro?.updatedAt
        ? new Date(libro.updatedAt as Date).toISOString()
        : null,
    };
  }

  /**
   * Guarda (o reemplaza) el acta de un año y tipo. El archivo se escribe antes
   * de la transacción; si la BD falla se borra, y el archivo anterior solo se
   * borra después del commit.
   */
  async subirActa(
    dto: SubirActaDto,
    archivo: ArchivoSubido | undefined,
    actorId: number,
  ) {
    if (!archivo?.buffer?.length) {
      throw new BadRequestException('Adjunta el archivo del acta');
    }
    if (archivo.buffer.length > MAX_BYTES_ACTA) {
      throw new BadRequestException(
        'El archivo excede el tamaño máximo de 15 MB',
      );
    }
    const extension = extensionPorContenido(archivo.buffer);
    if (!extension) {
      throw new BadRequestException('El acta debe ser un archivo PDF o TIFF');
    }

    // El nombre se arma aquí; nunca se usa el nombre que mandó el cliente.
    const rutaRelativa = `Actas/${dto.anio}/${dto.tipo}-${Date.now()}.${extension}`;
    const completa = this.resolverRuta(rutaRelativa);
    if (!completa) throw new BadRequestException('Ruta de archivo no válida');
    await mkdir(path.dirname(completa), { recursive: true });
    await writeFile(completa, archivo.buffer);

    const tipoMovimientoId = TIPO_DE_ACTA[dto.tipo];
    const transaction = await this.sequelize.transaction();
    let anterior: string | null = null;
    let libro: Libro;
    try {
      const existente = await this.libroModel.findOne({
        where: { tipoMovimientoId, anio: String(dto.anio) },
        order: [['id', 'DESC']],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (existente) {
        anterior = existente.ruta;
        libro = await existente.update({ ruta: rutaRelativa }, { transaction });
      } else {
        libro = await this.libroModel.create(
          { tipoMovimientoId, anio: String(dto.anio), ruta: rutaRelativa },
          { transaction },
        );
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback().catch(() => undefined);
      await unlink(completa).catch(() => undefined);
      if (error instanceof UniqueConstraintError) {
        throw new ConflictException(
          'Ya existe un acta de ese tipo y año. Intenta de nuevo.',
        );
      }
      throw error;
    }

    if (anterior && anterior !== rutaRelativa) {
      const vieja = this.resolverRuta(anterior);
      if (vieja) await unlink(vieja).catch(() => undefined);
    }
    // TODO Fase 4: generar el soporte (Excel) del libro; ruta_soporte no se toca aquí.
    this.logger.log(
      `Usuario ${actorId} cargó el acta ${dto.tipo} del año ${dto.anio}`,
    );
    return this.filaActa(dto.tipo, dto.anio, libro);
  }

  async descargar(
    id: number,
    cual: 'acta' | 'soporte',
  ): Promise<StreamableFile> {
    const libro = await this.libroModel.findByPk(id);
    const ruta = cual === 'acta' ? libro?.ruta : libro?.rutaSoporte;
    const completa = ruta ? this.resolverRuta(ruta) : null;
    if (!libro || !completa) {
      throw new NotFoundException('Archivo no encontrado');
    }
    try {
      await access(completa);
      if (!(await stat(completa)).isFile()) throw new Error('no es archivo');
    } catch {
      throw new NotFoundException('Archivo no encontrado');
    }

    const nombre = path.basename(completa);
    const respaldo = nombre.replace(/[^\x20-\x7e]|["\\]/g, '_');
    return new StreamableFile(createReadStream(completa), {
      type:
        CONTENT_TYPES[path.extname(nombre).toLowerCase()] ??
        'application/octet-stream',
      disposition: `attachment; filename="${respaldo}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
    });
  }
}
