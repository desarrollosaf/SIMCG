import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { puedeEditarServidores } from '../../core/access/acceso-por-rol';
import { AuthService } from '../../core/services/auth.service';
import { sinCambiosPendientesGuard } from './servidores-navegacion';
import { ServidoresRefresco } from './servidores-refresco';

// Alta y edición solo para Administrador y Registro (el backend también lo valida).
const puedeEditarGuard: CanActivateFn = () =>
  puedeEditarServidores(inject(AuthService).currentUser()?.roles) ||
  inject(Router).parseUrl('/servidores');

const formulario = () => import('./formulario/servidor-form').then((m) => m.ServidorForm);

// La lista vive en '' y sus rutas hijas se abren como modales sobre ella.
export const SERVIDORES_ROUTES: Routes = [
  {
    path: '',
    providers: [ServidoresRefresco],
    loadComponent: () => import('./lista/servidores-lista').then((m) => m.ServidoresLista),
    children: [
      {
        path: 'nuevo',
        canActivate: [puedeEditarGuard],
        canDeactivate: [sinCambiosPendientesGuard],
        loadComponent: formulario,
      },
      {
        path: ':id/editar',
        canActivate: [puedeEditarGuard],
        canDeactivate: [sinCambiosPendientesGuard],
        loadComponent: formulario,
      },
      {
        path: ':id/movimientos',
        loadComponent: () =>
          import('./movimientos/servidor-movimientos').then((m) => m.ServidorMovimientos),
      },
    ],
  },
];
