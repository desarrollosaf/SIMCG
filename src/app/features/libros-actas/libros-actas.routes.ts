import { Routes } from '@angular/router';

export const LIBROS_ACTAS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./libros-actas').then((m) => m.LibrosActas),
  },
];
