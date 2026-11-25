import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { puedeEditarServidores } from '../../core/access/acceso-por-rol';
import { AuthService } from '../../core/services/auth.service';

// Alta y edición solo para Administrador y Registro (el backend también lo valida).
const puedeEditarGuard: CanActivateFn = () =>
  puedeEditarServidores(inject(AuthService).currentUser()?.roles) ||
  inject(Router).parseUrl('/servidores');

export const SERVIDORES_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./lista/servidores-lista').then((m) => m.ServidoresLista),
  },
  {
    path: 'nuevo',
    canActivate: [puedeEditarGuard],
    loadComponent: () => import('./formulario/servidor-form').then((m) => m.ServidorForm),
  },
  {
    path: ':id/editar',
    canActivate: [puedeEditarGuard],
    loadComponent: () => import('./formulario/servidor-form').then((m) => m.ServidorForm),
  },
  {
    path: ':id/movimientos',
    loadComponent: () =>
      import('./movimientos/servidor-movimientos').then((m) => m.ServidorMovimientos),
  },
];
