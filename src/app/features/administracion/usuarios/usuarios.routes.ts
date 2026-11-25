import { Routes } from '@angular/router';

export const USUARIOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./usuarios').then((m) => m.Usuarios),
  },
];
