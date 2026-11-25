import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService, AuthUser } from '../services/auth.service';
import { roleGuard } from './role.guard';

describe('roleGuard', () => {
  const usuario = signal<AuthUser | null>(null);
  const arbolHome = {} as UrlTree;
  const router = { parseUrl: vi.fn().mockReturnValue(arbolHome) };

  const ejecutar = (seccion: Parameters<typeof roleGuard>[0]) =>
    TestBed.runInInjectionContext(() =>
      roleGuard(seccion)({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

  beforeEach(() => {
    router.parseUrl.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { currentUser: usuario } },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('permite el paso si el rol tiene acceso a la sección', () => {
    usuario.set({ id: 1, nombre: 'Admin', email: 'a@a.com', roles: ['Administrador'] });
    expect(ejecutar('administracion')).toBe(true);
  });

  it('redirige a /home si el rol no tiene acceso', () => {
    usuario.set({ id: 2, nombre: 'Consulta', email: 'c@a.com', roles: ['Consulta'] });
    expect(ejecutar('administracion')).toBe(arbolHome);
    expect(router.parseUrl).toHaveBeenCalledWith('/home');
  });

  it('redirige a /home si no hay sesión', () => {
    usuario.set(null);
    expect(ejecutar('servidores')).toBe(arbolHome);
  });
});
