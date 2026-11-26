import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

const proximamente = () => import('./shared/proximamente/proximamente').then((m) => m.Proximamente);

export const routes: Routes = [
  {
    path: 'login',
    loadChildren: () => import('./features/login/login.routes').then((m) => m.LOGIN_ROUTES),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      {
        path: 'home',
        loadChildren: () => import('./features/home/home.routes').then((m) => m.HOME_ROUTES),
      },
      {
        path: 'servidores',
        canActivate: [roleGuard('servidores')],
        loadChildren: () =>
          import('./features/servidores/servidores.routes').then((m) => m.SERVIDORES_ROUTES),
      },
      {
        path: 'cargas',
        canActivate: [roleGuard('cargas')],
        loadChildren: () => import('./features/cargas/cargas.routes').then((m) => m.CARGAS_ROUTES),
      },
      {
        path: 'libros-actas',
        canActivate: [roleGuard('libros-actas')],
        loadChildren: () =>
          import('./features/libros-actas/libros-actas.routes').then((m) => m.LIBROS_ACTAS_ROUTES),
      },
      // Módulos pendientes: se reemplazan por su feature real en cada fase.
      {
        path: 'reportes',
        canActivate: [roleGuard('reportes')],
        data: { titulo: 'Reporte General' },
        loadComponent: proximamente,
      },
      {
        path: 'oficios',
        canActivate: [roleGuard('oficios')],
        data: { titulo: 'Notificaciones y oficios' },
        loadComponent: proximamente,
      },
      {
        path: 'declaraciones-intereses',
        canActivate: [roleGuard('declaraciones-intereses')],
        data: { titulo: 'Declaraciones de intereses' },
        loadComponent: proximamente,
      },
      {
        path: 'declaraciones/fiscal',
        canActivate: [roleGuard('declaraciones')],
        data: { titulo: 'Declaración fiscal' },
        loadComponent: proximamente,
      },
      {
        path: 'declaraciones/fiscal-aclaraciones',
        canActivate: [roleGuard('declaraciones')],
        data: { titulo: 'Aclaraciones de declaración fiscal' },
        loadComponent: proximamente,
      },
      {
        path: 'declaraciones/aclaraciones',
        canActivate: [roleGuard('declaraciones')],
        data: { titulo: 'Aclaraciones' },
        loadComponent: proximamente,
      },
      {
        path: 'estadisticas',
        canActivate: [roleGuard('estadisticas')],
        data: { titulo: 'Estadísticas por tipo' },
        loadComponent: proximamente,
      },
      {
        path: 'reportes/omisos',
        canActivate: [roleGuard('reportes')],
        loadComponent: () => import('./features/reportes/omisos/omisos').then((m) => m.ReportesOmisos),
      },
      {
        path: 'reportes/preventivos',
        canActivate: [roleGuard('reportes')],
        loadComponent: () =>
          import('./features/reportes/preventivos/preventivos').then((m) => m.ReportesPreventivos),
      },
      {
        path: 'reportes/situacion-servidor',
        canActivate: [roleGuard('reportes')],
        data: { titulo: 'Consultar situación del Servidor Público' },
        loadComponent: proximamente,
      },
      {
        path: 'reportes/situacion-dependencias',
        canActivate: [roleGuard('reportes')],
        data: { titulo: 'Consultar situación Dependencias' },
        loadComponent: proximamente,
      },
      {
        path: 'reportes/no-obligados',
        canActivate: [roleGuard('reportes')],
        data: { titulo: 'Reporte No Obligados' },
        loadComponent: proximamente,
      },
      {
        path: 'estadisticas/situacion-padron',
        canActivate: [roleGuard('estadisticas')],
        data: { titulo: 'Situación del Padrón' },
        loadComponent: proximamente,
      },
      {
        path: 'evoluciones-patrimoniales',
        canActivate: [roleGuard('administracion')],
        data: { titulo: 'Evoluciones patrimoniales' },
        loadComponent: proximamente,
      },
      {
        path: 'administracion/usuarios',
        canActivate: [roleGuard('administracion')],
        loadChildren: () =>
          import('./features/administracion/usuarios/usuarios.routes').then(
            (m) => m.USUARIOS_ROUTES,
          ),
      },
      {
        path: 'administracion/roles',
        canActivate: [roleGuard('administracion')],
        loadChildren: () =>
          import('./features/administracion/roles/roles.routes').then((m) => m.ROLES_ROUTES),
      },
      {
        path: 'administracion/auditoria',
        canActivate: [roleGuard('administracion')],
        data: { titulo: 'Movimientos de usuarios' },
        loadComponent: proximamente,
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
