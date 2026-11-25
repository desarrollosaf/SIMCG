import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getConnectionToken, getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Op, UniqueConstraintError } from 'sequelize';
import { Declaracion } from '../database/models/declaracion.model';
import { Libro } from '../database/models/libro.model';
import { ServidorPublico } from '../database/models/servidor-publico.model';
import { TipoMovimientoMcg } from '../database/models/tipo-movimiento-mcg.model';
import { LibrosService } from './libros.service';

const PDF = Buffer.from('%PDF-1.4 contenido');
const TIFF_II = Buffer.from([0x49, 0x49, 0x2a, 0x00, 1, 2, 3]);
const subida = (buffer: Buffer) => ({
  buffer,
  originalname: '../../etc/passwd.pdf',
  mimetype: 'application/pdf',
  size: buffer.length,
});

describe('LibrosService', () => {
  let service: LibrosService;
  let dir: string;

  const transaction = {
    commit: jest.fn(),
    rollback: jest.fn(),
    LOCK: { UPDATE: 'UPDATE' },
  };
  const sequelize = { transaction: jest.fn() };
  const sequelizeDeclaranet = { query: jest.fn() };
  const servidorModel = { findAll: jest.fn() };
  const libroModel = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
  };
  const tipoMovimientoModel = { findAll: jest.fn() };
  const declaracionModel = { findAndCountAll: jest.fn() };

  const escribir = (relativa: string, contenido: Buffer | string = 'x') => {
    const completa = path.join(dir, relativa);
    fs.mkdirSync(path.dirname(completa), { recursive: true });
    fs.writeFileSync(completa, contenido);
    return completa;
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'simcg-libros-'));
    sequelize.transaction.mockResolvedValue(transaction);
    transaction.rollback.mockResolvedValue(undefined);

    const modulo = await Test.createTestingModule({
      providers: [
        LibrosService,
        { provide: getConnectionToken(), useValue: sequelize },
        {
          provide: getConnectionToken('declaranet'),
          useValue: sequelizeDeclaranet,
        },
        { provide: getModelToken(ServidorPublico), useValue: servidorModel },
        { provide: getModelToken(Libro), useValue: libroModel },
        {
          provide: getModelToken(TipoMovimientoMcg),
          useValue: tipoMovimientoModel,
        },
        {
          provide: getModelToken(Declaracion, 'declaranet'),
          useValue: declaracionModel,
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(dir) },
        },
      ],
    }).compile();
    service = modulo.get(LibrosService);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe('anios', () => {
    it('une años enviados, año actual y años de libros, en orden descendente', async () => {
      sequelizeDeclaranet.query.mockResolvedValue([
        { anio: 2022 },
        { anio: 2023 },
      ]);
      libroModel.findAll.mockResolvedValue([
        { anio: '2021' },
        { anio: '2023' },
        { anio: 'x' },
        { anio: null },
      ]);

      const anios = await service.anios();

      expect(anios).toEqual(
        [...new Set([new Date().getFullYear(), 2023, 2022, 2021])].sort(
          (a, b) => b - a,
        ),
      );
    });
  });

  describe('resumen', () => {
    it('suma inicial + reingreso y deja en cero lo que no aparece', async () => {
      sequelizeDeclaranet.query.mockResolvedValue([
        { tipo: 1, total: '10', fiscal: '3', aclaraciones: '1' },
        { tipo: 2, total: 2, fiscal: null, aclaraciones: '1' },
        { tipo: 4, total: '5', fiscal: '0', aclaraciones: '0' },
      ]);

      const r = await service.resumen(2025);

      expect(r).toEqual({
        anio: 2025,
        inicial: { total: 12, fiscal: 3, aclaraciones: 2 },
        modificacion: { total: 0, fiscal: 0, aclaraciones: 0 },
        conclusion: { total: 5, fiscal: 0, aclaraciones: 0 },
      });
      expect(sequelizeDeclaranet.query).toHaveBeenCalledWith(
        expect.stringContaining('GROUP BY'),
        {
          type: 'SELECT',
          replacements: expect.objectContaining({
            desde: '2025-01-01',
            hasta: '2026-01-01',
          }) as object,
        },
      );
    });
  });

  describe('declaraciones', () => {
    const declaracion = {
      id: 9,
      servidorPublicoId: 5,
      tipoMovimientoId: 1,
      cargo: ' ANALISTA ',
      fechaEnvio: '2025-03-01',
    };
    const servidor = {
      id: 5,
      nombre: 'ANA',
      primerApellido: 'LOPEZ',
      segundoApellido: 'DIAZ',
      curp: 'LOPA010101MMCPNA09 ',
      cargo: 'OTRO',
      dependencia: { nombre: 'DEP' },
      direccion: null,
    };

    beforeEach(() => {
      declaracionModel.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: [declaracion],
      });
      servidorModel.findAll.mockResolvedValue([servidor]);
      tipoMovimientoModel.findAll.mockResolvedValue([
        { id: 1, valor: 'INICIAL (INGRESO)' },
      ]);
    });

    it('arma la página con los datos del servidor, sin buscar', async () => {
      const r = await service.declaraciones({
        anio: 2025,
        tipo: 'inicial',
        inicio: 0,
        limite: 10,
      });

      expect(r).toEqual({
        total: 1,
        filas: [
          {
            id: 9,
            servidorId: 5,
            nombre: 'ANA LOPEZ DIAZ',
            cargo: 'ANALISTA',
            curp: 'LOPA010101MMCPNA09',
            dependencia: 'DEP',
            direccion: null,
            tipoMovimiento: 'INICIAL (INGRESO)',
            fechaEnvio: '2025-03-01',
          },
        ],
      });
      // Una sola consulta de servidores (la de la página), sin buscar ids.
      expect(servidorModel.findAll).toHaveBeenCalledTimes(1);
      expect(declaracionModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({ offset: 0, limit: 10 }),
      );
    });

    it('con buscar primero obtiene los ids de servidores y filtra por ellos', async () => {
      servidorModel.findAll
        .mockResolvedValueOnce([{ id: 5 }])
        .mockResolvedValueOnce([servidor]);

      const r = await service.declaraciones({
        anio: 2025,
        tipo: 'inicial',
        buscar: '50% ana',
      });

      expect(r.total).toBe(1);
      expect(servidorModel.findAll).toHaveBeenCalledTimes(2);
      type Like = { nombre: { [Op.like]: string } };
      const consulta = (
        servidorModel.findAll.mock.calls[0] as unknown[]
      )[0] as {
        where: { [Op.and]: { [Op.or]: Like[] }[] };
      };
      const [primera] = consulta.where[Op.and];
      // El comodín % del texto buscado se escapa para que sea literal.
      expect(primera[Op.or][0].nombre[Op.like]).toBe('%50\\%%');
    });

    it('con buscar sin coincidencias regresa vacío sin consultar declaraciones', async () => {
      servidorModel.findAll.mockResolvedValueOnce([]);

      const r = await service.declaraciones({
        anio: 2025,
        tipo: 'conclusion',
        buscar: 'nadie',
      });

      expect(r).toEqual({ total: 0, filas: [] });
      expect(declaracionModel.findAndCountAll).not.toHaveBeenCalled();
    });
  });

  describe('actas', () => {
    it('regresa 3 filas y verifica que los archivos existan en disco', async () => {
      escribir('Actas/2025/inicial.pdf');
      libroModel.findAll.mockResolvedValue([
        {
          id: 1,
          tipoMovimientoId: 1,
          anio: '2025',
          ruta: 'Actas/2025/inicial.pdf',
          rutaSoporte: 'Soportes/falta.xlsx',
          updatedAt: new Date('2025-05-01T00:00:00Z'),
        },
        {
          id: 2,
          tipoMovimientoId: 3,
          anio: '2025',
          ruta: 'Actas/2025/no-existe.pdf',
          rutaSoporte: null,
          updatedAt: new Date('2025-05-02T00:00:00Z'),
        },
      ]);

      const r = await service.actas(2025);

      expect(r).toEqual([
        {
          tipo: 'inicial',
          tipoMovimientoId: 1,
          id: 1,
          anio: 2025,
          tieneActa: true,
          nombreActa: 'inicial.pdf',
          tieneSoporte: false,
          actualizado: '2025-05-01T00:00:00.000Z',
        },
        {
          tipo: 'modificacion',
          tipoMovimientoId: 3,
          id: 2,
          anio: 2025,
          tieneActa: false,
          nombreActa: null,
          tieneSoporte: false,
          actualizado: '2025-05-02T00:00:00.000Z',
        },
        {
          tipo: 'conclusion',
          tipoMovimientoId: 4,
          id: null,
          anio: 2025,
          tieneActa: false,
          nombreActa: null,
          tieneSoporte: false,
          actualizado: null,
        },
      ]);
    });

    it('no considera existente un archivo fuera de ARCHIVOS_DIR', async () => {
      libroModel.findAll.mockResolvedValue([
        { id: 1, tipoMovimientoId: 1, anio: '2025', ruta: '../fuera.pdf' },
      ]);
      const [inicial] = await service.actas(2025);
      expect(inicial.tieneActa).toBe(false);
    });
  });

  describe('subirActa', () => {
    const dto = { anio: 2027, tipo: 'inicial' as const };

    it('crea el libro nuevo y guarda el archivo con nombre propio', async () => {
      libroModel.findOne.mockResolvedValue(null);
      libroModel.create.mockImplementation((valores: { ruta: string }) =>
        Promise.resolve({ id: 7, ...valores, updatedAt: new Date() }),
      );

      const r = await service.subirActa(dto, subida(PDF), 1);

      const [valores, opciones] = libroModel.create.mock.calls[0] as [
        { ruta: string; tipoMovimientoId: number; anio: string },
        object,
      ];
      expect(valores.ruta).toMatch(/^Actas\/2027\/inicial-\d+\.pdf$/);
      expect(valores).toMatchObject({ tipoMovimientoId: 1, anio: '2027' });
      expect(opciones).toEqual({ transaction });
      expect(libroModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ lock: 'UPDATE', transaction }),
      );
      expect(fs.existsSync(path.join(dir, valores.ruta))).toBe(true);
      expect(transaction.commit).toHaveBeenCalled();
      expect(r).toMatchObject({ tipo: 'inicial', id: 7, tieneActa: true });
    });

    it('al reemplazar borra el archivo anterior solo después del commit', async () => {
      const vieja = escribir('Actas/2027/inicial-1.pdf');
      const actualizar = jest
        .fn()
        .mockImplementation((v: object) =>
          Promise.resolve({ id: 7, ...v, updatedAt: new Date() }),
        );
      libroModel.findOne.mockResolvedValue({
        id: 7,
        ruta: 'Actas/2027/inicial-1.pdf',
        update: actualizar,
      });
      transaction.commit.mockImplementation(() => {
        expect(fs.existsSync(vieja)).toBe(true);
        return Promise.resolve();
      });

      await service.subirActa(dto, subida(TIFF_II), 1);

      expect(actualizar).toHaveBeenCalledWith(
        { ruta: expect.stringMatching(/\.tif$/) as string },
        { transaction },
      );
      expect(fs.existsSync(vieja)).toBe(false);
    });

    it('si la BD falla borra el archivo nuevo y conserva el anterior', async () => {
      const vieja = escribir('Actas/2027/inicial-1.pdf');
      libroModel.findOne.mockResolvedValue({
        id: 7,
        ruta: 'Actas/2027/inicial-1.pdf',
        update: jest.fn().mockRejectedValue(new Error('BD')),
      });

      await expect(service.subirActa(dto, subida(PDF), 1)).rejects.toThrow(
        'BD',
      );

      expect(transaction.rollback).toHaveBeenCalled();
      expect(fs.existsSync(vieja)).toBe(true);
      expect(fs.readdirSync(path.join(dir, 'Actas/2027'))).toEqual([
        'inicial-1.pdf',
      ]);
    });

    it('responde 409 si choca con el índice único', async () => {
      libroModel.findOne.mockResolvedValue(null);
      libroModel.create.mockRejectedValue(new UniqueConstraintError({}));

      await expect(service.subirActa(dto, subida(PDF), 1)).rejects.toThrow(
        ConflictException,
      );
    });

    it('rechaza archivos que no son PDF ni TIFF aunque se llamen .pdf', async () => {
      await expect(
        service.subirActa(dto, subida(Buffer.from('MZ ejecutable')), 1),
      ).rejects.toThrow('PDF o TIFF');
      expect(sequelize.transaction).not.toHaveBeenCalled();
    });

    it('rechaza archivo faltante o mayor de 15 MB', async () => {
      await expect(service.subirActa(dto, undefined, 1)).rejects.toThrow(
        BadRequestException,
      );
      const grande = Buffer.alloc(15 * 1024 * 1024 + 1);
      PDF.copy(grande);
      await expect(service.subirActa(dto, subida(grande), 1)).rejects.toThrow(
        '15 MB',
      );
    });
  });

  describe('descargar', () => {
    it('regresa el archivo como StreamableFile', async () => {
      escribir('Actas/2025/INICIAL 2022.pdf', PDF);
      libroModel.findByPk.mockResolvedValue({
        id: 1,
        ruta: 'Actas/2025/INICIAL 2022.pdf',
      });

      const r = await service.descargar(1, 'acta');

      expect(r).toBeInstanceOf(StreamableFile);
      expect(r.getHeaders()).toMatchObject({ type: 'application/pdf' });
      r.getStream().destroy();
    });

    it('404 si no hay fila, ruta o archivo', async () => {
      libroModel.findByPk.mockResolvedValue(null);
      await expect(service.descargar(1, 'acta')).rejects.toThrow(
        NotFoundException,
      );
      libroModel.findByPk.mockResolvedValue({
        id: 1,
        ruta: 'a',
        rutaSoporte: null,
      });
      await expect(service.descargar(1, 'soporte')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.descargar(1, 'acta')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rechaza rutas que salen de ARCHIVOS_DIR (path traversal)', async () => {
      libroModel.findByPk.mockResolvedValue({
        id: 1,
        ruta: '../../etc/passwd',
        rutaSoporte: path.resolve(dir, '..'),
      });
      await expect(service.descargar(1, 'acta')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.descargar(1, 'soporte')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
