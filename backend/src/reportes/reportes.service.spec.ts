import { getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import * as XLSX from 'xlsx-js-style';
import { Declaracion } from '../database/models/declaracion.model';
import { EnvioCorreo } from '../database/models/envio-correo.model';
import { ServidorPublico } from '../database/models/servidor-publico.model';
import { TipoMovimientoMcg } from '../database/models/tipo-movimiento-mcg.model';
import { ExcelService } from '../documentos/excel.service';
import { hoyMexico, sumarDias } from '../servidores/movimientos.reglas';
import { ReportesService, columnasCorreo } from './reportes.service';

const ENCABEZADOS_PREVENTIVO = [
  'NOMBRE',
  'APELLIDO PATERNO',
  'APELLIDO MATERNO',
  'CURP',
  'CARGO',
  'DEPENDENCIA',
  'DIRECCION',
  'DEPARTAMENTO',
  'NIVEL CARGO',
  'T. DE MOVIMIENTO',
  'F. DE MOVIMIENTO',
  'ENVÍO',
  'ESTADO DEL SP',
  'CORREO ENVIADO',
  'TIPO DE CORREO',
  'OFICIOS GENERADOS',
  'NO. OFICIO',
  'FECHA DE ELABORACION',
];

const ENCABEZADOS_REMISION = ENCABEZADOS_PREVENTIVO.filter(
  (e) => e !== 'CORREO ENVIADO' && e !== 'TIPO DE CORREO',
);

const HOY = hoyMexico();

const servidor = (id: number) => ({
  id,
  nombre: 'Ana',
  primerApellido: 'Ruiz',
  segundoApellido: 'Gómez',
  curp: 'abcd800101hmcxxx01',
  cargo: 'Jefa',
  nivelCargo: '25-1',
  dependencia: { nombre: 'Dep' },
  direccion: { nombre: 'Dir' },
  departamento: { nombre: 'Depto' },
});

const declaracion = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  servidorPublicoId: 1,
  tipoMovimientoId: 1,
  fechaDeclaracion: '2026-01-01',
  fechaEnvio: null,
  obligado: true,
  ...extra,
});

describe('ReportesService', () => {
  let servicio: ReportesService;
  const servidorModel = { findAll: jest.fn() };
  const tipoMovimientoModel = { findAll: jest.fn() };
  const envioCorreoModel = { findAll: jest.fn() };
  const declaracionModel = { findAll: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    tipoMovimientoModel.findAll.mockResolvedValue([
      { id: 1, valor: 'INGRESO' },
      { id: 3, valor: 'MODIFICACION' },
    ]);
    const modulo = await Test.createTestingModule({
      providers: [
        ReportesService,
        ExcelService,
        { provide: getModelToken(ServidorPublico), useValue: servidorModel },
        {
          provide: getModelToken(TipoMovimientoMcg),
          useValue: tipoMovimientoModel,
        },
        { provide: getModelToken(EnvioCorreo), useValue: envioCorreoModel },
        {
          provide: getModelToken(Declaracion, 'declaranet'),
          useValue: declaracionModel,
        },
      ],
    }).compile();
    servicio = modulo.get(ReportesService);
  });

  describe('omisos', () => {
    it('devuelve solo OMISO y ENVIO EXTEMPORANEO con los datos del servidor', async () => {
      const viejo = sumarDias(HOY, -100);
      declaracionModel.findAll.mockResolvedValue([
        declaracion(1, { fechaDeclaracion: viejo }), // omiso
        declaracion(2, {
          fechaDeclaracion: viejo,
          fechaEnvio: sumarDias(viejo, 90),
        }), // extemporáneo
        declaracion(3, {
          fechaDeclaracion: viejo,
          fechaEnvio: sumarDias(viejo, 10),
        }), // a tiempo: no sale
        declaracion(4, { fechaDeclaracion: sumarDias(HOY, -10) }), // en tiempo: no sale
        declaracion(5, { servidorPublicoId: 99, fechaDeclaracion: viejo }), // sin servidor
      ]);
      servidorModel.findAll.mockResolvedValue([servidor(1)]);

      const filas = await servicio.omisos('2020-01-01', '2030-01-01');

      expect(filas.map((f) => [f.id, f.estatus])).toEqual([
        [1, 'OMISO'],
        [2, 'ENVIO EXTEMPORANEO'],
      ]);
      expect(filas[0]).toMatchObject({
        servidorId: 1,
        nombre: 'Ana',
        primerApellido: 'Ruiz',
        segundoApellido: 'Gómez',
        cargo: 'Jefa',
        dependencia: 'Dep',
        direccion: 'Dir',
        departamento: 'Depto',
        tipoMovimiento: 'INGRESO',
        fechaDeclaracion: viejo,
        fechaEnvio: null,
      });
    });

    it('filtra obligados, sin intereses y por rango de fechas en la consulta', async () => {
      declaracionModel.findAll.mockResolvedValue([]);
      await servicio.omisos('2026-01-01', '2026-06-30');
      const { where } = (
        declaracionModel.findAll.mock.calls as unknown[][]
      )[0][0] as {
        where: Record<string, unknown>;
      };
      expect(Object.keys(where)).toEqual(
        expect.arrayContaining([
          'obligado',
          'tipoMovimientoId',
          'fechaDeclaracion',
        ]),
      );
      const rango = where.fechaDeclaracion as Record<symbol, string[]>;
      const [operador] = Object.getOwnPropertySymbols(rango);
      expect(rango[operador]).toEqual(['2026-01-01', '2026-06-30']);
      expect(servidorModel.findAll).not.toHaveBeenCalled();
    });
  });

  describe('preventivos', () => {
    it('devuelve solo EN TIEMPO (sin envío y límite posterior a hoy)', async () => {
      declaracionModel.findAll.mockResolvedValue([
        declaracion(1, { fechaDeclaracion: sumarDias(HOY, -10) }),
        declaracion(2, { fechaDeclaracion: sumarDias(HOY, -200) }),
        // modificación a 29 días: dentro de los 30
        declaracion(3, {
          tipoMovimientoId: 3,
          fechaDeclaracion: sumarDias(HOY, -29),
        }),
        // modificación a 30 días: límite == hoy, el viejo no la mostraba
        declaracion(4, {
          tipoMovimientoId: 3,
          fechaDeclaracion: sumarDias(HOY, -30),
        }),
      ]);
      servidorModel.findAll.mockResolvedValue([servidor(1)]);

      const filas = await servicio.preventivos();

      expect(filas.map((f) => [f.id, f.estatus])).toEqual([
        [1, 'EN TIEMPO'],
        [3, 'EN TIEMPO'],
      ]);
    });
  });

  describe('excelCorreos', () => {
    const leer = (buffer: Buffer) => {
      const libro = XLSX.read(buffer, { type: 'buffer' });
      return XLSX.utils.sheet_to_json<unknown[]>(
        libro.Sheets[libro.SheetNames[0]],
        { header: 1, defval: '' },
      );
    };

    it('columnas exactas y en orden: PREVENTIVO 18, REMISION 16', () => {
      expect(columnasCorreo('PREVENTIVO').map((c) => c.encabezado)).toEqual(
        ENCABEZADOS_PREVENTIVO,
      );
      expect(columnasCorreo('REMISION').map((c) => c.encabezado)).toEqual(
        ENCABEZADOS_REMISION,
      );
      expect(ENCABEZADOS_PREVENTIVO).toHaveLength(18);
      expect(ENCABEZADOS_REMISION).toHaveLength(16);
    });

    it('PREVENTIVO: fila con mayúsculas donde el blade usa strtoupper', async () => {
      envioCorreoModel.findAll.mockResolvedValue([
        {
          servidorPublicoId: 1,
          declaracionId: 10,
          total: 2,
          totalOficiosGenerados: 3,
          noOficio: '0200',
          fechaEnvio: '2026-11-20',
        },
        // servidor inexistente: sin fila
        {
          servidorPublicoId: 77,
          declaracionId: 10,
          total: 1,
          totalOficiosGenerados: 0,
          noOficio: null,
          fechaEnvio: '2026-11-20',
        },
      ]);
      servidorModel.findAll.mockResolvedValue([servidor(1)]);
      declaracionModel.findAll.mockResolvedValue([
        declaracion(10, { fechaEnvio: '2026-03-01' }),
      ]);

      const filas = leer(
        await servicio.excelCorreos('PREVENTIVO', '2026-11-01', '2026-11-30'),
      );

      expect(filas[0]).toEqual(ENCABEZADOS_PREVENTIVO);
      expect(filas).toHaveLength(2);
      expect(filas[1]).toEqual([
        'ANA',
        'RUIZ',
        'GÓMEZ',
        'ABCD800101HMCXXX01',
        'JEFA',
        'DEP',
        'DIR',
        'DEPTO',
        '25-1',
        'INGRESO',
        '2026-01-01',
        'ENVIADA EL: 2026-03-01',
        'OBLIGADO',
        2,
        'PREVENTIVO',
        3,
        '0200',
        '2026-11-20',
      ]);
      const consulta = (
        envioCorreoModel.findAll.mock.calls as unknown[][]
      )[0][0] as {
        where: { tipoCorreo: number };
      };
      expect(consulta.where.tipoCorreo).toBe(1);
    });

    it('REMISION: sin las dos columnas de correo, SIN ENVIO y NO OBLIGADO', async () => {
      envioCorreoModel.findAll.mockResolvedValue([
        {
          servidorPublicoId: 1,
          declaracionId: 10,
          total: 0,
          totalOficiosGenerados: null,
          noOficio: '0123',
          fechaEnvio: '2026-11-21',
        },
      ]);
      servidorModel.findAll.mockResolvedValue([servidor(1)]);
      declaracionModel.findAll.mockResolvedValue([
        declaracion(10, { obligado: false }),
      ]);

      const filas = leer(
        await servicio.excelCorreos('REMISION', '2026-11-01', '2026-11-30'),
      );

      expect(filas[0]).toEqual(ENCABEZADOS_REMISION);
      expect(filas[1]).toHaveLength(16);
      expect(filas[1].slice(11)).toEqual([
        'SIN ENVIO',
        'NO OBLIGADO',
        '',
        '0123',
        '2026-11-21',
      ]);
      const consulta = (
        envioCorreoModel.findAll.mock.calls as unknown[][]
      )[0][0] as {
        where: { tipoCorreo: number };
      };
      expect(consulta.where.tipoCorreo).toBe(2);
    });

    it('sin registros solo trae los encabezados', async () => {
      envioCorreoModel.findAll.mockResolvedValue([]);
      declaracionModel.findAll.mockResolvedValue([]);
      const filas = leer(
        await servicio.excelCorreos('REMISION', '2026-11-01', '2026-11-30'),
      );
      expect(filas).toEqual([ENCABEZADOS_REMISION]);
    });
  });
});
