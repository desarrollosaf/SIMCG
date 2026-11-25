import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import { Folio } from '../database/models/folio.model';
import {
  MODEL_TYPE_USER,
  ModelHasRole,
} from '../database/models/model-has-role.model';
import { Rol } from '../database/models/rol.model';
import { ServidorPublico } from '../database/models/servidor-publico.model';
import { User } from '../database/models/user.model';
import { AccesoDto } from './dto/acceso.dto';
import { UsuariosService } from './usuarios.service';

describe('UsuariosService', () => {
  let service: UsuariosService;

  const transaction = { id: 'tx' };
  const sequelize = {
    transaction: jest.fn((cb: (t: unknown) => unknown) => cb(transaction)),
    query: jest.fn(),
  };
  const userModel = { findOne: jest.fn(), findByPk: jest.fn() };
  const servidorModel = { findOne: jest.fn() };
  const modelHasRoleModel = {
    findAll: jest.fn(),
    destroy: jest.fn(),
    create: jest.fn(),
  };
  const rolModel = { findOne: jest.fn() };
  const folioModel = { create: jest.fn() };

  const dto: AccesoDto = {
    rfc: 'AAAA010101',
    curp: 'AAAA010101HMCAAA01',
    homoclave: 'AB1',
    rol: 'Consulta',
  };

  const filaUsuario = (id: number) => ({
    id,
    name: 'cuenta',
    email: 'u@correo.com',
    verificacion: true,
    servidor: {
      nombre: 'ANA',
      primerApellido: 'LOPEZ',
      segundoApellido: null,
      curp: dto.curp,
      dependencia: { nombre: 'Contraloría' },
    },
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const modulo = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: getConnectionToken(), useValue: sequelize },
        { provide: getModelToken(User), useValue: userModel },
        { provide: getModelToken(ServidorPublico), useValue: servidorModel },
        { provide: getModelToken(ModelHasRole), useValue: modelHasRoleModel },
        { provide: getModelToken(Rol), useValue: rolModel },
        { provide: getModelToken(Folio), useValue: folioModel },
      ],
    }).compile();
    service = modulo.get(UsuariosService);
  });

  describe('darAcceso', () => {
    it('responde 404 si no existe el servidor público', async () => {
      servidorModel.findOne.mockResolvedValue(null);

      await expect(service.darAcceso(dto, 1)).rejects.toThrow(
        new NotFoundException('No existe registro del servidor público'),
      );
      expect(modelHasRoleModel.create).not.toHaveBeenCalled();
    });

    it('responde 404 si el servidor no tiene usuario en Declaranet', async () => {
      servidorModel.findOne.mockResolvedValue({ id: 10 });
      userModel.findOne.mockResolvedValue(null);

      await expect(service.darAcceso(dto, 1)).rejects.toThrow(
        new NotFoundException(
          'El servidor público no tiene usuario en Declaranet',
        ),
      );
      expect(folioModel.create).not.toHaveBeenCalled();
    });

    it('responde 400 si el administrador intenta cambiar su propio rol', async () => {
      servidorModel.findOne.mockResolvedValue({ id: 10 });
      userModel.findOne.mockResolvedValue({ id: 1, update: jest.fn() });

      await expect(service.darAcceso(dto, 1)).rejects.toThrow(
        new BadRequestException('No puedes cambiar tu propio rol'),
      );
      expect(modelHasRoleModel.destroy).not.toHaveBeenCalled();
      expect(modelHasRoleModel.create).not.toHaveBeenCalled();
    });

    it('verifica al usuario, reemplaza su rol y crea el folio consecutivo', async () => {
      const user = { id: 55, update: jest.fn() };
      servidorModel.findOne.mockResolvedValue({ id: 10 });
      userModel.findOne.mockResolvedValue(user);
      rolModel.findOne.mockResolvedValue({ id: 3, name: 'Consulta' });
      sequelize.query.mockResolvedValue([{ maximo: '19' }]);
      userModel.findByPk.mockResolvedValue(filaUsuario(55));

      const resultado = await service.darAcceso(dto, 1);

      expect(servidorModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { rfc: dto.rfc, curp: dto.curp, homoclave: dto.homoclave },
        }),
      );
      expect(user.update).toHaveBeenCalledWith(
        { verificacion: true },
        { transaction },
      );
      expect(modelHasRoleModel.destroy).toHaveBeenCalledWith({
        where: { modelType: MODEL_TYPE_USER, modelId: 55 },
        transaction,
      });
      expect(modelHasRoleModel.create).toHaveBeenCalledWith(
        { roleId: 3, modelType: MODEL_TYPE_USER, modelId: 55 },
        { transaction },
      );
      expect(
        modelHasRoleModel.destroy.mock.invocationCallOrder[0],
      ).toBeLessThan(modelHasRoleModel.create.mock.invocationCallOrder[0]);
      expect(folioModel.create).toHaveBeenCalledWith(
        {
          foliosableId: 55,
          foliosableType: MODEL_TYPE_USER,
          noFolio: '20',
          tipoOficioId: 1,
        },
        { transaction },
      );
      expect(resultado).toMatchObject({
        id: 55,
        nombre: 'ANA LOPEZ',
        dependencia: 'Contraloría',
        roles: ['Consulta'],
      });
      expect(JSON.stringify(resultado)).not.toContain('password');
    });

    it('arranca el folio en 1 si la tabla está vacía', async () => {
      servidorModel.findOne.mockResolvedValue({ id: 10 });
      userModel.findOne.mockResolvedValue({ id: 55, update: jest.fn() });
      rolModel.findOne.mockResolvedValue({ id: 3 });
      sequelize.query.mockResolvedValue([{ maximo: null }]);
      userModel.findByPk.mockResolvedValue(filaUsuario(55));

      await service.darAcceso(dto, 1);

      expect(folioModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ noFolio: '1' }),
        { transaction },
      );
    });
  });

  describe('baja', () => {
    it('no permite que el administrador se dé de baja a sí mismo', async () => {
      await expect(service.baja(1, 1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(sequelize.transaction).not.toHaveBeenCalled();
    });

    it('responde 404 si el usuario no existe', async () => {
      userModel.findByPk = jest.fn().mockResolvedValue(null);

      await expect(service.baja(99, 1)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('pone verificacion en 0 y quita todos los roles sin borrar el registro', async () => {
      const user = { id: 8, update: jest.fn(), destroy: jest.fn() };
      userModel.findByPk = jest.fn().mockResolvedValue(user);

      await service.baja(8, 1);

      expect(user.update).toHaveBeenCalledWith(
        { verificacion: false },
        { transaction },
      );
      expect(modelHasRoleModel.destroy).toHaveBeenCalledWith({
        where: { modelType: MODEL_TYPE_USER, modelId: 8 },
        transaction,
      });
      expect(user.destroy).not.toHaveBeenCalled();
    });
  });

  describe('listar', () => {
    it('devuelve vacío si nadie tiene rol', async () => {
      modelHasRoleModel.findAll.mockResolvedValue([]);

      await expect(service.listar()).resolves.toEqual([]);
    });

    it('arma las filas sin exponer datos sensibles', async () => {
      modelHasRoleModel.findAll.mockResolvedValue([
        { modelId: 5, rol: { name: 'Registro' } },
      ]);
      userModel.findAll = jest.fn().mockResolvedValue([filaUsuario(5)]);

      const filas = await service.listar();

      expect(filas).toEqual([
        {
          id: 5,
          nombre: 'ANA LOPEZ',
          curp: dto.curp,
          dependencia: 'Contraloría',
          email: 'u@correo.com',
          roles: ['Registro'],
          verificacion: true,
        },
      ]);
    });
  });
});
