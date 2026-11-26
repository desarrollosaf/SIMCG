import type { NombreIcono } from '../../shared/icono/icono';
import { Seccion, puedeVer } from './acceso-por-rol';

// Única fuente de verdad del menú lateral y del buscador global.
export interface MenuHoja {
  etiqueta: string;
  ruta: string;
  seccion: Seccion;
  descripcion?: string;
  icono?: NombreIcono;
  /** Nombre corto para el menú colapsado (el buscador usa la etiqueta completa). */
  corto?: string;
}

export interface MenuGrupo {
  etiqueta: string;
  /** Nombre corto para el menú colapsado. */
  corto?: string;
  icono?: NombreIcono;
  hijos: MenuHoja[];
}

export type MenuEntrada = MenuHoja | MenuGrupo;

export function esGrupo(entrada: MenuEntrada): entrada is MenuGrupo {
  return 'hijos' in entrada;
}

export const MENU: readonly MenuEntrada[] = [
  { etiqueta: 'Inicio', corto: 'Inicio', ruta: '/home', icono: 'documento', seccion: 'servidores' },
  {
    etiqueta: 'Análisis de evoluciones patrimoniales',
    corto: 'Evoluciones',
    ruta: '/evoluciones-patrimoniales',
    icono: 'tendencia',
    seccion: 'administracion',
  },
  {
    etiqueta: 'Padrón de obligados',
    corto: 'Padrón',
    icono: 'usuarios',
    hijos: [
      {
        etiqueta: 'Registro de servidores públicos',
        descripcion: 'Consulta, alta y movimientos',
        ruta: '/servidores',
        icono: 'usuario',
        seccion: 'servidores',
      },
      {
        etiqueta: 'Carga de registros con CSV',
        descripcion: 'Altas masivas',
        ruta: '/cargas',
        icono: 'subir',
        seccion: 'cargas',
      },
    ],
  },
  {
    etiqueta: 'Declaraciones',
    corto: 'Declaraciones',
    icono: 'documentoCheck',
    hijos: [
      {
        etiqueta: 'Declaración fiscal',
        ruta: '/declaraciones/fiscal',
        icono: 'documento',
        seccion: 'declaraciones',
      },
      {
        etiqueta: 'Aclaraciones de declaración fiscal',
        ruta: '/declaraciones/fiscal-aclaraciones',
        icono: 'documentoCheck',
        seccion: 'declaraciones',
      },
      {
        etiqueta: 'Aclaraciones',
        ruta: '/declaraciones/aclaraciones',
        icono: 'sobre',
        seccion: 'declaraciones',
      },
      {
        etiqueta: 'Actualización de declaraciones de intereses',
        ruta: '/declaraciones-intereses',
        icono: 'documentoCheck',
        seccion: 'declaraciones-intereses',
      },
    ],
  },
  {
    etiqueta: 'Detección de omisos',
    corto: 'Omisos',
    icono: 'radar',
    hijos: [
      {
        etiqueta: 'Omisos, extemporáneos y no obligados',
        ruta: '/reportes/omisos',
        icono: 'radar',
        seccion: 'reportes',
      },
      {
        etiqueta: 'Preventivos',
        ruta: '/reportes/preventivos',
        icono: 'escudo',
        seccion: 'reportes',
      },
    ],
  },
  {
    etiqueta: 'Reportes',
    corto: 'Reportes',
    icono: 'documento',
    hijos: [
      { etiqueta: 'Reporte general', ruta: '/reportes', icono: 'documento', seccion: 'reportes' },
      {
        etiqueta: 'Reporte de no obligados',
        ruta: '/reportes/no-obligados',
        icono: 'usuarioX',
        seccion: 'reportes',
      },
      {
        etiqueta: 'Situación del padrón',
        ruta: '/estadisticas/situacion-padron',
        icono: 'pastel',
        seccion: 'estadisticas',
      },
      {
        etiqueta: 'Situación por servidor público',
        ruta: '/reportes/situacion-servidor',
        icono: 'usuarioBuscar',
        seccion: 'reportes',
      },
      {
        etiqueta: 'Situación por dependencia',
        ruta: '/reportes/situacion-dependencias',
        icono: 'edificio',
        seccion: 'reportes',
      },
    ],
  },
  {
    etiqueta: 'Estadísticas por tipo',
    corto: 'Estadísticas',
    ruta: '/estadisticas',
    icono: 'grafica',
    seccion: 'estadisticas',
  },
  { etiqueta: 'Notificaciones', corto: 'Notificaciones', ruta: '/oficios', icono: 'sobre', seccion: 'oficios' },
  {
    etiqueta: 'Administración',
    corto: 'Admin',
    icono: 'engrane',
    hijos: [
      {
        etiqueta: 'Usuarios',
        ruta: '/administracion/usuarios',
        icono: 'usuarioMas',
        seccion: 'administracion',
      },
      {
        etiqueta: 'Movimientos de usuarios',
        ruta: '/administracion/auditoria',
        icono: 'historial',
        seccion: 'administracion',
      },
      {
        etiqueta: 'Libros de cierre',
        ruta: '/libros-actas',
        icono: 'libro',
        seccion: 'libros-actas',
      },
    ],
  },
];

/** Menú visible para los roles dados; los grupos sin hijos permitidos se omiten. */
export function menuParaRoles(
  roles: readonly string[] | null | undefined,
  menu: readonly MenuEntrada[] = MENU,
): MenuEntrada[] {
  const resultado: MenuEntrada[] = [];
  for (const entrada of menu) {
    if (esGrupo(entrada)) {
      const hijos = entrada.hijos.filter((h) => puedeVer(roles, h.seccion));
      if (hijos.length) resultado.push({ ...entrada, hijos });
    } else if (puedeVer(roles, entrada.seccion)) {
      resultado.push(entrada);
    }
  }
  return resultado;
}

export interface MenuHojaConGrupo extends MenuHoja {
  grupo: string | null;
}

/** Lista plana de destinos (para el buscador global). */
export function aplanarMenu(entradas: readonly MenuEntrada[]): MenuHojaConGrupo[] {
  return entradas.flatMap((e): MenuHojaConGrupo[] =>
    esGrupo(e) ? e.hijos.map((h) => ({ ...h, grupo: e.etiqueta })) : [{ ...e, grupo: null }],
  );
}

/** Ruta del menú que mejor coincide con la URL (la más específica). */
export function rutaActiva(url: string, hojas: readonly MenuHoja[]): string | null {
  const path = url.split(/[?#]/)[0];
  let mejor: string | null = null;
  for (const { ruta } of hojas) {
    if ((path === ruta || path.startsWith(ruta + '/')) && (!mejor || ruta.length > mejor.length)) {
      mejor = ruta;
    }
  }
  return mejor;
}
