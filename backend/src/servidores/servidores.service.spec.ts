import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import { Declaracion } from '../database/models/declaracion.model';
import { Respuesta } from '../database/models/respuesta.model';
import { ServidorPublico } from '../database/models/servidor-publico.model';
import { TipoDepartamento } from '../database/models/tipo-departamento.model';
import { TipoDependencia } from '../database/models/tipo-dependencia.model';
import { TipoDireccion } from '../database/models/tipo-direccion.model';
import { TipoMovimientoMcg } from '../database/models/tipo-movimiento-mcg.model';
import { User } from '../database/models/user.model';
import { ActualizarServidorDto } from './dto/actualizar-servidor.dto';
import { CrearServidorDto } from './dto/crear-servidor.dto';
import { ServidoresService } from './servidores.service';

describe('ServidoresService', () => {
  let service: ServidoresService;

  const transaction = {
    commit: jest.fn(),
    rollback: jest.fn(),
  };
  const sequelize = {
    transaction: jest.fn((cb?: (t: unknown) => unknown) =>
      cb ? cb(transaction) : Promise.resolve(transaction),
    ),
  };
  const servidorModel = {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    findAndCountAll: jest.fn(),
  };
  const userModel = { findOne: jest.fn() };
  const dependenciaModel = { findByPk: jest.fn() };
  const direccionModel = { findByPk: jest.fn() };
  const departamentoModel = { findByPk: jest.fn() };
  const tipoMovimientoModel = { findByPk: jest.fn() };
  const respuestaModel = { findByPk: jest.fn() };
  const declaracionModel = { create: jest.fn() };

  const dto: CrearServidorDto = {
    nombre: 'ANA',
    primerApellido: 'LOPEZ',
    segundoApellido: null,
    rfc: 'LOPA010101',
    homoclave: 'AB1',
    curp: 'LOPA010101MMCPNA09',
    cargo: 'ANALISTA',
    nivelCargo: '25-1',
    cveIssemym: null,
    tipoDependenciaId: 3,
    tipoDireccionId: 7,
    tipoDepartamentoId: null,
    honorarios: 2,
    fechaInicio: '2025-01-01',
    tipoMovimientoId: 1,
    fechaDeclaracion: '2025-01-15',
  };

  const servidorGuardado = { id: 50, ...dto };

  beforeEach(async () => {
    jest.resetAllMocks();
    sequelize.transaction.mockImplementation((cb?: (t: unknown) => unknown) =>
      cb ? cb(transaction) : Promise.resolve(transaction),
    );
    transaction.rollback.mockResolvedValue(undefined);
    dependenciaModel.findByPk.mockResolvedValue({ id: 3 });
    direccionModel.findByPk.mockResolvedValue({ id: 7, dependenciaId: 3 });
    respuestaModel.findByPk.mockResolvedValue({ id: 2 });
    tipoMovimientoModel.findByPk.mockResolvedValue({ id: 1 });
    servidorModel.findOne.mockResolvedValue(null);

    const modulo = await Test.createTestingModule({
      providers: [
        ServidoresService,
        { provide: getConnectionToken(), useValue: sequelize },
        { provide: getModelToken(ServidorPublico), useValue: servidorModel },
        { provide: getModelToken(User), useValue: userModel },
        { provide: getModelToken(TipoDependencia), useValue: dependenciaModel },
        { provide: getModelToken(TipoDireccion), useValue: direccionModel },
        {
          provide: getModelToken(TipoDepartamento),
          useValue: departamentoModel,
        },
        {
          provide: getModelToken(TipoMovimientoMcg),
          useValue: tipoMovimientoModel,
        },
        { provide: getModelToken(Respuesta), useValue: respuestaModel },
        {
          provide: getModelToken(Declaracion, 'declaranet'),
          useValue: declaracionModel,
        },
      ],
    }).compile();
    service = modulo.get(ServidoresService);
  });

  describe('crear', () => {
    const preparaExito = () => {
      servidorModel.create.mockResolvedValue(servidorGuardado);
      declaracionModel.create.mockResolvedValue({
        id: 900,
        destroy: jest.fn(),
      });
      // detalle() final
      servidorModel.findByPk.mockResolvedValue({
        ...servidorGuardado,
        presentaVersionLarga: false,
      });
      userModel.findOne.mockResolvedValue(null);
    };

    it('crea el servidor y su declaración inicial y confirma', async () => {
      preparaExito();

      const resultado = await service.crear(dto, 1);

      expect(servidorModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          curp: dto.curp,
          rfc: dto.rfc,
          fechaInicio: '2025-01-01',
          tipoDependenciaId: 3,
        }),
        { transaction },
      );
      expect(declaracionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          servidorPublicoId: 50,
          tipoMovimientoId: 1,
          fechaDeclaracion: '2025-01-15',
          estatusDeclaracionId: 1,
          honorarios: 2,
        }),
      );
      expect(transaction.commit).toHaveBeenCalled();
      expect(transaction.rollback).not.toHaveBeenCalled();
      expect(resultado.id).toBe(50);
    });

    it('responde 409 si la CURP ya existe y no crea nada', async () => {
      servidorModel.findOne.mockResolvedValue({ curp: dto.curp, rfc: 'OTRO' });

      await expect(service.crear(dto, 1)).rejects.toThrow(
        new ConflictException('Ya existe un servidor público con esa CURP'),
      );
      expect(servidorModel.create).not.toHaveBeenCalled();
      expect(declaracionModel.create).not.toHaveBeenCalled();
      expect(transaction.rollback).toHaveBeenCalled();
    });

    it('responde 409 si el RFC con homoclave ya existe', async () => {
      servidorModel.findOne.mockResolvedValue({
        curp: 'OTRACURP',
        rfc: dto.rfc,
      });

      await expect(service.crear(dto, 1)).rejects.toThrow(
        new ConflictException(
          'Ya existe un servidor público con ese RFC y homoclave',
        ),
      );
    });

    it('si falla la declaración hace rollback del servidor (compensación)', async () => {
      servidorModel.create.mockResolvedValue(servidorGuardado);
      declaracionModel.create.mockRejectedValue(new Error('declaranet caído'));

      await expect(service.crear(dto, 1)).rejects.toThrow('declaranet caído');
      expect(transaction.commit).not.toHaveBeenCalled();
      expect(transaction.rollback).toHaveBeenCalled();
    });

    it('si falla el commit borra la declaración ya creada', async () => {
      const declaracion = {
        id: 900,
        destroy: jest.fn().mockResolvedValue(undefined),
      };
      servidorModel.create.mockResolvedValue(servidorGuardado);
      declaracionModel.create.mockResolvedValue(declaracion);
      transaction.commit.mockRejectedValue(new Error('commit falló'));

      await expect(service.crear(dto, 1)).rejects.toThrow('commit falló');
      expect(transaction.rollback).toHaveBeenCalled();
      expect(declaracion.destroy).toHaveBeenCalledWith({ force: true });
    });

    it('rechaza una dirección que no es de la dependencia', async () => {
      direccionModel.findByPk.mockResolvedValue({ id: 7, dependenciaId: 99 });

      await expect(service.crear(dto, 1)).rejects.toThrow(
        new BadRequestException('La dirección no pertenece a la dependencia'),
      );
      expect(sequelize.transaction).not.toHaveBeenCalled();
    });

    it('rechaza un departamento que no es de la dirección', async () => {
      departamentoModel.findByPk.mockResolvedValue({
        id: 11,
        dependenciaId: 3,
        direccionId: 8,
      });

      await expect(
        service.crear({ ...dto, tipoDepartamentoId: 11 }, 1),
      ).rejects.toThrow(
        new BadRequestException('El departamento no pertenece a la dirección'),
      );
    });

    it('rechaza un departamento sin dirección', async () => {
      await expect(
        service.crear(
          { ...dto, tipoDireccionId: null, tipoDepartamentoId: 11 },
          1,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza el tipo de movimiento INTERESES', async () => {
      await expect(
        service.crear({ ...dto, tipoMovimientoId: 5 }, 1),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza una respuesta de honorarios inexistente', async () => {
      respuestaModel.findByPk.mockResolvedValue(null);

      await expect(service.crear(dto, 1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('actualizar', () => {
    const dtoActualizar: ActualizarServidorDto = { ...dto };

    it('responde 404 si no existe', async () => {
      servidorModel.findByPk.mockResolvedValue(null);

      await expect(service.actualizar(1, dtoActualizar, 2)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('exige motivo si se cambia el correo', async () => {
      servidorModel.findByPk.mockResolvedValue({ id: 1, update: jest.fn() });

      await expect(
        service.actualizar(1, { ...dtoActualizar, email: 'a@b.com' }, 2),
      ).rejects.toThrow(
        new BadRequestException(
          'El motivo del cambio de correo es obligatorio',
        ),
      );
    });

    it('excluye al propio servidor al buscar duplicados', async () => {
      const servidor = {
        id: 1,
        cargo: 'X',
        nivelCargo: '25-1',
        update: jest.fn(),
      };
      servidorModel.findByPk.mockResolvedValue(servidor);
      userModel.findOne.mockResolvedValue(null);

      await service.actualizar(1, dtoActualizar, 2);

      const [consulta] = servidorModel.findOne.mock.calls[0] as [
        { where: { id?: unknown } },
      ];
      expect(consulta.where.id).toBeDefined();
      expect(servidor.update).toHaveBeenCalledWith(
        expect.objectContaining({ cargo: 'ANALISTA' }),
        { transaction },
      );
    });
  });

  describe('baja', () => {
    it('hace soft delete del servidor', async () => {
      const servidor = { id: 4, destroy: jest.fn() };
      servidorModel.findByPk.mockResolvedValue(servidor);
      userModel.findOne.mockResolvedValue({ id: 99 });

      await service.baja(4, 'RENUNCIA', 1);

      expect(servidor.destroy).toHaveBeenCalled();
    });

    it('no deja que un usuario dé de baja su propio servidor', async () => {
      servidorModel.findByPk.mockResolvedValue({ id: 4, destroy: jest.fn() });
      userModel.findOne.mockResolvedValue({ id: 1 });

      await expect(service.baja(4, 'RENUNCIA', 1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('cambiarVersionLarga', () => {
    it('rechaza activarla si el nivel no la permite', async () => {
      const servidor = { id: 4, nivelCargo: '12-1', update: jest.fn() };
      servidorModel.findByPk.mockResolvedValue(servidor);

      await expect(
        service.cambiarVersionLarga(4, true, 1),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(servidor.update).not.toHaveBeenCalled();
    });

    it('la activa si el nivel está entre 25 y 43', async () => {
      const servidor = { id: 4, nivelCargo: '30-2', update: jest.fn() };
      servidorModel.findByPk.mockResolvedValue(servidor);

      await service.cambiarVersionLarga(4, true, 1);

      expect(servidor.update).toHaveBeenCalledWith({
        presentaVersionLarga: true,
      });
    });

    it('siempre permite desactivarla', async () => {
      const servidor = { id: 4, nivelCargo: '12-1', update: jest.fn() };
      servidorModel.findByPk.mockResolvedValue(servidor);

      await service.cambiarVersionLarga(4, false, 1);

      expect(servidor.update).toHaveBeenCalledWith({
        presentaVersionLarga: false,
      });
    });
  });
});
