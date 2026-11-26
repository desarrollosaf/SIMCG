import { Routes } from '@angular/router';

export const CARGAS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./carga-servidores').then((m) => m.CargaServidores),
  },
];
