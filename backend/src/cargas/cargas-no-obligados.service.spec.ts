import { getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import { Declaracion } from '../database/models/declaracion.model';
import { ServidorPublico } from '../database/models/servidor-publico.model';
import { TipoMovimientoMcg } from '../database/models/tipo-movimiento-mcg.model';
import { CargasNoObligadosService } from './cargas-no-obligados.service';

const CURP = 'LOPA010101MMCPNA09';
const RFC = 'LOPA010101';

const csv = (...renglones: string[]) => ({
  buffer: Buffer.from(
    ['curp,rfc,tipo_movimiento,fecha_de_movimiento', ...renglones].join('\n'),
  ),
  originalname: 'no-obligados.csv',
  mimetype: 'text/csv',
  size: 1,
});

describe('CargasNoObligadosService', () => {
  let service: CargasNoObligadosService;

  const servidorModel = { findAll: jest.fn() };
  const tipoMovimientoModel = { findAll: jest.fn() };
  const declaracionModel = { findAll: jest.fn(), update: jest.fn() };

  const servidor = {
    id: 5,
    nombre: 'ANA',
    primerApellido: 'LOPEZ',
    segundoApellido: null,
    // Los datos viejos traen espacios sobrantes.
    curp: ` ${CURP} `,
    rfc: `${RFC} `,
  };
  const declaracion = (id: number, extra: object = {}) => ({
    id,
    servidorPublicoId: 5,
    tipoMovimientoId: 1,
    fechaDeclaracion: '2025-01-15',
    obligado: true,
    ...extra,
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    servidorModel.findAll.mockResolvedValue([servidor]);
    tipoMovimientoModel.findAll.mockResolvedValue([
      { id: 1, valor: 'INICIAL (INGRESO)' },
    ]);
    declaracionModel.findAll.mockResolvedValue([declaracion(100)]);

    const modulo = await Test.createTestingModule({
      providers: [
        CargasNoObligadosService,
        { provide: getModelToken(ServidorPublico), useValue: servidorModel },
        {
          provide: getModelToken(TipoMovimientoMcg),
          useValue: tipoMovimientoModel,
        },
        {
          provide: getModelToken(Declaracion, 'declaranet'),
          useValue: declaracionModel,
        },
      ],
    }).compile();
    service = modulo.get(CargasNoObligadosService);
  });

  describe('previsualizar', () => {
    it('marca como aplicable la declaración encontrada (tolera espacios en BD y alias)', async () => {
      const r = await service.previsualizar(csv(`${CURP},${RFC},1,15/01/2025`));

      expect(r).toEqual({
        total: 1,
        aplicables: 1,
        omitidos: 0,
        filas: [
          {
            renglon: 2,
            curp: CURP,
            nombre: 'ANA LOPEZ',
            tipoMovimiento: 'INICIAL (INGRESO)',
            fechaMovimiento: '2025-01-15',
            estado: 'aplicar',
            errores: [],
          },
        ],
      });
    });

    it('distingue aplicar, ya_no_obligado y error', async () => {
      declaracionModel.findAll.mockResolvedValue([
        declaracion(100),
        declaracion(101, { tipoMovimientoId: 3, obligado: false }),
      ]);

      const r = await service.previsualizar(
        csv(
          `${CURP},${RFC},1,15/01/2025`, // aplicar
          `${CURP},${RFC},3,15/01/2025`, // ya no obligado
          `${CURP},${RFC},4,15/01/2025`, // sin declaración
          `${CURP},OTRA010101,1,15/01/2025`, // servidor no encontrado
          `MALA,${RFC},9,31/02/2025`, // formatos
          `${CURP},${RFC},1,15/01/2025`, // repetido
        ),
      );

      expect(r.filas.map((f) => f.estado)).toEqual([
        'aplicar',
        'ya_no_obligado',
        'error',
        'error',
        'error',
        'error',
      ]);
      expect(r.filas[2].errores[0]).toContain('No se encontró la declaración');
      expect(r.filas[3].errores[0]).toContain('Servidor público no encontrado');
      expect(r.filas[4].errores).toHaveLength(3);
      expect(r.filas[5].errores).toEqual(['Repetido en el renglón 2']);
      expect(r).toMatchObject({ total: 6, aplicables: 1, omitidos: 5 });
    });
  });

  describe('confirmar', () => {
    it('actualiza todas las declaraciones coincidentes en una sola sentencia', async () => {
      declaracionModel.findAll.mockResolvedValue([
        declaracion(100),
        declaracion(101), // duplicada del mismo movimiento y fecha
        declaracion(102, { obligado: false }), // ya no obligada: no se toca
      ]);
      declaracionModel.update.mockResolvedValue([2]);

      const r = await service.confirmar(
        csv(`${CURP},${RFC},1,15/01/2025`, `MALA,${RFC},1,15/01/2025`),
        1,
      );

      expect(r).toEqual({
        actualizados: 2,
        renglonesAplicados: 1,
        omitidos: 1,
      });
      expect(declaracionModel.update).toHaveBeenCalledTimes(1);
      const [valores, opciones] = declaracionModel.update.mock.calls[0] as [
        object,
        { where: { id: Record<symbol, number[]> } },
      ];
      expect(valores).toEqual({ obligado: false, motivoNoObligadoId: 3 });
      const [ids] = Object.getOwnPropertySymbols(opciones.where.id).map(
        (s) => opciones.where.id[s],
      );
      expect(ids).toEqual([100, 101]);
    });

    it('responde 400 si no hay nada que aplicar', async () => {
      await expect(
        service.confirmar(csv(`MALA,${RFC},1,15/01/2025`), 1),
      ).rejects.toThrow('No hay renglones por aplicar');
      expect(declaracionModel.update).not.toHaveBeenCalled();
    });
  });

  it('el layout trae BOM y encabezado', () => {
    const texto = service.layout().toString('utf-8');
    expect(texto.charCodeAt(0)).toBe(0xfeff);
    expect(texto.slice(1).split('\r\n')[0]).toBe(
      'curp,rfc,tipo_movimiento,fecha_movimiento',
    );
  });
});
