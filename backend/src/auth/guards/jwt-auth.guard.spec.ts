import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const jwtService = { verifyAsync: jest.fn() };
  const config = { get: jest.fn().mockReturnValue('secreto') };
  const authService = { sesionVigente: jest.fn() };
  let guard: JwtAuthGuard;

  const contexto = (request: Record<string, unknown>) =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new JwtAuthGuard(
      jwtService as unknown as JwtService,
      config as unknown as ConfigService,
      authService as unknown as AuthService,
    );
  });

  it('acepta una sesión vigente y usa los roles actuales de la BD', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 7,
      email: 'a@b.com',
      roles: ['Administrador'],
    });
    authService.sesionVigente.mockResolvedValue(['Consulta']);
    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer abc' },
    };

    await expect(guard.canActivate(contexto(request))).resolves.toBe(true);

    expect(authService.sesionVigente).toHaveBeenCalledWith(7);
    expect(request['user']).toEqual({
      sub: 7,
      email: 'a@b.com',
      roles: ['Consulta'],
    });
  });

  it('rechaza al usuario dado de baja o sin rol (401)', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 7, roles: ['Consulta'] });
    authService.sesionVigente.mockRejectedValue(
      new UnauthorizedException('Sesión no válida'),
    );

    await expect(
      guard.canActivate(contexto({ headers: { authorization: 'Bearer abc' } })),
    ).rejects.toThrow(new UnauthorizedException('Sesión no válida'));
  });

  it('rechaza un token inválido sin consultar la BD', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt malformed'));

    await expect(
      guard.canActivate(contexto({ headers: { authorization: 'Bearer abc' } })),
    ).rejects.toThrow(new UnauthorizedException('Token inválido o expirado'));
    expect(authService.sesionVigente).not.toHaveBeenCalled();
  });
});
