import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';

export const CARGAS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./carga-servidores').then((m) => m.CargaServidores),
  },
  {
    path: 'no-obligados',
    canActivate: [roleGuard('administracion')],
    loadComponent: () => import('./carga-no-obligados').then((m) => m.CargaNoObligados),
  },
];
