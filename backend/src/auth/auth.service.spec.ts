import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getConnectionToken, getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { ModelHasRole } from '../database/models/model-has-role.model';
import { User } from '../database/models/user.model';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let hashLaravel: string;

  const userModel = { findOne: jest.fn() };
  const sequelize = { query: jest.fn() };
  const modelHasRoleModel = { findAll: jest.fn() };
  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('token-firmado'),
  };
  const config = {
    get: jest.fn((clave: string) =>
      clave === 'auth.jwtSecret' ? 'secreto' : 28800,
    ),
  };

  const usuarioBase = () => ({
    id: 7,
    name: 'Nombre cuenta',
    email: 'ana@correo.com',
    password: hashLaravel,
    verificacion: true,
    servidor: {
      nombre: 'ANA',
      primerApellido: 'LOPEZ',
      segundoApellido: 'RUIZ',
    },
  });

  beforeAll(async () => {
    // Laravel guarda los hashes con prefijo $2y$.
    const hash = await bcrypt.hash('secreto123', 4);
    hashLaravel = hash.replace(/^\$2[abxy]\$/, '$2y$');
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const modulo = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getConnectionToken(), useValue: sequelize },
        { provide: getModelToken(User), useValue: userModel },
        { provide: getModelToken(ModelHasRole), useValue: modelHasRoleModel },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = modulo.get(AuthService);
    modelHasRoleModel.findAll.mockResolvedValue([
      { rol: { name: 'Administrador' } },
    ]);
  });

  it('inicia sesión con un hash $2y$ de Laravel y firma el token', async () => {
    userModel.findOne.mockResolvedValue(usuarioBase());

    const resultado = await service.login('ana@correo.com', 'secreto123');

    expect(resultado.token).toBe('token-firmado');
    expect(resultado.usuario).toEqual({
      id: 7,
      nombre: 'ANA LOPEZ RUIZ',
      email: 'ana@correo.com',
      roles: ['Administrador'],
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { sub: 7, email: 'ana@correo.com', roles: ['Administrador'] },
      expect.objectContaining({ secret: 'secreto', expiresIn: 28800 }),
    );
    expect(JSON.stringify(resultado)).not.toContain('password');
  });

  it('rechaza una contraseña incorrecta con el mensaje genérico', async () => {
    userModel.findOne.mockResolvedValue(usuarioBase());

    await expect(service.login('ana@correo.com', 'mala')).rejects.toThrow(
      new UnauthorizedException('Credenciales inválidas'),
    );
  });

  it('rechaza un correo que no existe', async () => {
    userModel.findOne.mockResolvedValue(null);

    await expect(service.login('nadie@correo.com', 'x')).rejects.toThrow(
      new UnauthorizedException('Credenciales inválidas'),
    );
  });

  it('rechaza al usuario sin rol', async () => {
    userModel.findOne.mockResolvedValue(usuarioBase());
    modelHasRoleModel.findAll.mockResolvedValue([]);

    await expect(service.login('ana@correo.com', 'secreto123')).rejects.toThrow(
      new UnauthorizedException('Credenciales inválidas'),
    );
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('rechaza al usuario con verificacion = 0', async () => {
    userModel.findOne.mockResolvedValue({
      ...usuarioBase(),
      verificacion: false,
    });

    await expect(service.login('ana@correo.com', 'secreto123')).rejects.toThrow(
      new UnauthorizedException('Credenciales inválidas'),
    );
  });

  it('perfil devuelve el usuario actual y rechaza si la sesión ya no es vigente', async () => {
    userModel.findOne.mockResolvedValue(usuarioBase());
    sequelize.query.mockResolvedValue([{ nombre: 'Administrador' }]);
    await expect(service.perfil(7)).resolves.toMatchObject({ id: 7 });

    sequelize.query.mockResolvedValue([]);
    await expect(service.perfil(7)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('sesionVigente devuelve los roles de la BD o responde 401', async () => {
    sequelize.query.mockResolvedValue([{ nombre: 'Consulta' }]);
    await expect(service.sesionVigente(7)).resolves.toEqual(['Consulta']);

    sequelize.query.mockResolvedValue([]);
    await expect(service.sesionVigente(7)).rejects.toThrow(
      new UnauthorizedException('Sesión no válida'),
    );
  });
});
