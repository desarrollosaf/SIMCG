import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import { Declaracion } from '../database/models/declaracion.model';
import { EnvioCorreo } from '../database/models/envio-correo.model';
import { MotivoNoObligado } from '../database/models/motivo-no-obligado.model';
import { ServidorPublico } from '../database/models/servidor-publico.model';
import { TipoMovimientoMcg } from '../database/models/tipo-movimiento-mcg.model';
import { MovimientosService } from './movimientos.service';

describe('MovimientosService', () => {
  let service: MovimientosService;

  const servidorModel = { findByPk: jest.fn() };
  const tipoMovimientoModel = { findAll: jest.fn() };
  const envioCorreoModel = { findAll: jest.fn() };
  const declaracionModel = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
  };
  const motivoModel = { findByPk: jest.fn() };

  const tipos = [1, 2, 3, 4].map((id) => ({ id, valor: `TIPO ${id}` }));
  const servidor = {
    id: 7,
    cargo: 'ANALISTA',
    nivelCargo: '25-1',
    honorarios: 2,
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    servidorModel.findByPk.mockResolvedValue(servidor);
    tipoMovimientoModel.findAll.mockResolvedValue(tipos);

    const modulo = await Test.createTestingModule({
      providers: [
        MovimientosService,
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
        {
          provide: getModelToken(MotivoNoObligado, 'declaranet'),
          useValue: motivoModel,
        },
      ],
    }).compile();
    service = modulo.get(MovimientosService);
  });

  describe('permitidos', () => {
    it('devuelve todos los tipos si no hay declaración este año (antes fallaba con 500)', async () => {
      declaracionModel.findOne.mockResolvedValue(null);

      const resultado = await service.permitidos(7);

      expect(resultado.map((t) => t.id)).toEqual([1, 2, 3, 4]);
    });

    it('quita ingreso si el último movimiento del año es reingreso', async () => {
      declaracionModel.findOne.mockResolvedValue({
        tipoMovimientoId: 2,
        fechaDeclaracion: '2025-02-01',
      });

      const resultado = await service.permitidos(7);

      expect(resultado.map((t) => t.id)).toEqual([2, 3, 4]);
    });

    it('responde 404 si el servidor no existe', async () => {
      servidorModel.findByPk.mockResolvedValue(null);

      await expect(service.permitidos(7)).rejects.toThrow(NotFoundException);
    });
  });

  describe('crear', () => {
    it('rechaza un tipo que no está permitido', async () => {
      declaracionModel.findOne.mockResolvedValue({
        tipoMovimientoId: 2,
        fechaDeclaracion: '2025-02-01',
      });

      await expect(service.crear(7, 1, 1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(declaracionModel.create).not.toHaveBeenCalled();
    });

    it('crea el movimiento con cargo y nivel del servidor y hereda los campos escalares', async () => {
      const previa = {
        tipoMovimientoId: 1,
        fechaDeclaracion: '2020-01-01',
        correoInstitucional: 'a@x.com',
        correoPersonal: 'b@x.com',
        telefonoCasa: '1',
        telefonoPersonal: '2',
        situacionPersonalId: 3,
        regimenMatrimonialId: 4,
        honorarios: 1,
        paisId: 5,
        nacionalidad: 'MEXICANA',
        nacionalidadId: 6,
        regimenEspecificar: null,
        observaciones: 'obs',
        regimenMatrimonial: null,
      };
      // 1ª llamada: último del año (permitidos); 2ª: declaración previa.
      declaracionModel.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(previa);
      declaracionModel.create.mockResolvedValue({ id: 321 });

      const resultado = await service.crear(7, 3, 1);

      expect(resultado).toEqual({ id: 321 });
      expect(declaracionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          servidorPublicoId: 7,
          tipoMovimientoId: 3,
          estatusDeclaracionId: 1,
          cargo: 'ANALISTA',
          nivelCargo: '25-1',
          correoInstitucional: 'a@x.com',
          situacionPersonalId: 3,
          honorarios: 1,
          observaciones: 'obs',
        }),
      );
    });

    it('un ingreso nuevo no hereda campos y usa los honorarios del servidor', async () => {
      declaracionModel.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          correoPersonal: 'viejo@x.com',
          honorarios: 1,
        });
      declaracionModel.create.mockResolvedValue({ id: 1 });

      await service.crear(7, 1, 1);

      const [datos] = declaracionModel.create.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(datos.correoPersonal).toBeUndefined();
      expect(datos.honorarios).toBe(2);
    });
  });

  describe('cambiarObligado', () => {
    it('responde 404 si el movimiento no existe', async () => {
      declaracionModel.findByPk.mockResolvedValue(null);

      await expect(
        service.cambiarObligado(1, true, undefined, 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('exige motivo cuando no es obligado', async () => {
      declaracionModel.findByPk.mockResolvedValue({ update: jest.fn() });

      await expect(
        service.cambiarObligado(1, false, undefined, 1),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza un motivo que no existe', async () => {
      declaracionModel.findByPk.mockResolvedValue({ update: jest.fn() });
      motivoModel.findByPk.mockResolvedValue(null);

      await expect(
        service.cambiarObligado(1, false, 99, 1),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('guarda no obligado con su motivo', async () => {
      const declaracion = { update: jest.fn() };
      declaracionModel.findByPk.mockResolvedValue(declaracion);
      motivoModel.findByPk.mockResolvedValue({ id: 2 });

      await service.cambiarObligado(1, false, 2, 1);

      expect(declaracion.update).toHaveBeenCalledWith({
        obligado: false,
        motivoNoObligadoId: 2,
      });
    });

    it('al volver a obligado limpia el motivo', async () => {
      const declaracion = { update: jest.fn() };
      declaracionModel.findByPk.mockResolvedValue(declaracion);

      await service.cambiarObligado(1, true, 2, 1);

      expect(declaracion.update).toHaveBeenCalledWith({
        obligado: true,
        motivoNoObligadoId: null,
      });
    });
  });

  describe('historial', () => {
    it('arma estado, estatus y oficios', async () => {
      declaracionModel.findAll.mockResolvedValue([
        {
          id: 10,
          tipoMovimientoId: 1,
          fechaDeclaracion: '2020-01-01',
          fechaEnvio: '2020-02-01',
          obligado: true,
          motivoNoObligadoId: null,
          motivoNoObligado: null,
        },
        {
          id: 11,
          tipoMovimientoId: 3,
          fechaDeclaracion: '2021-01-01',
          fechaEnvio: null,
          obligado: false,
          motivoNoObligadoId: 1,
          motivoNoObligado: { causa: 'POR DEFUNCIÓN' },
        },
      ]);
      envioCorreoModel.findAll.mockResolvedValue([
        { declaracionId: 10, tipoCorreo: 1, noOficio: '12/2020' },
        { declaracionId: 10, tipoCorreo: 2, noOficio: '99/2020' },
      ]);

      const [a, b] = await service.historial(7);

      expect(a).toMatchObject({
        tipo: 'TIPO 1',
        estado: 'OBLIGADO',
        estatus: 'ENVIO EN TIEMPO',
        oficioPreventivo: 'CPL/DSP/MCG/12/2020',
        oficioRemision: 'CPL/DSP/MCG/99/2020',
      });
      expect(b).toMatchObject({
        estado: 'NO OBLIGADO - POR DEFUNCIÓN',
        estatus: 'NO OBLIGADO - POR DEFUNCIÓN',
        oficioPreventivo: null,
        oficioRemision: null,
      });
    });

    it('sin declaraciones devuelve lista vacía', async () => {
      declaracionModel.findAll.mockResolvedValue([]);

      await expect(service.historial(7)).resolves.toEqual([]);
    });
  });

  describe('eliminar', () => {
    it('hace soft delete', async () => {
      const declaracion = { destroy: jest.fn() };
      declaracionModel.findByPk.mockResolvedValue(declaracion);

      await service.eliminar(1, 1);

      expect(declaracion.destroy).toHaveBeenCalled();
    });

    it('responde 404 si no existe', async () => {
      declaracionModel.findByPk.mockResolvedValue(null);

      await expect(service.eliminar(1, 1)).rejects.toThrow(NotFoundException);
    });
  });
});
