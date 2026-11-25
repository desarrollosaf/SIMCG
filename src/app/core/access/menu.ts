import { Seccion, puedeVer } from './acceso-por-rol';

// Única fuente de verdad del menú superior y del buscador global.
export interface MenuHoja {
  etiqueta: string;
  ruta: string;
  seccion: Seccion;
  descripcion?: string;
}

export interface MenuGrupo {
  etiqueta: string;
  hijos: MenuHoja[];
}

export type MenuEntrada = MenuHoja | MenuGrupo;

export function esGrupo(entrada: MenuEntrada): entrada is MenuGrupo {
  return 'hijos' in entrada;
}

export const MENU: readonly MenuEntrada[] = [
  { etiqueta: 'Inicio', ruta: '/home', seccion: 'servidores' },
  {
    etiqueta: 'Padrón de obligados',
    hijos: [
      {
        etiqueta: 'Registro de servidor público',
        descripcion: 'Consulta, alta y movimientos',
        ruta: '/servidores',
        seccion: 'servidores',
      },
      {
        etiqueta: 'Cargar registros con CSV',
        descripcion: 'Altas masivas',
        ruta: '/cargas',
        seccion: 'cargas',
      },
      {
        etiqueta: 'Cargar registros No Obligados CSV',
        ruta: '/cargas/no-obligados',
        seccion: 'administracion',
      },
    ],
  },
  {
    etiqueta: 'Detección',
    hijos: [
      {
        etiqueta: 'Detección de omisos, extemporáneos y no obligados',
        ruta: '/reportes/omisos',
        seccion: 'reportes',
      },
      { etiqueta: 'Detección preventivos', ruta: '/reportes/preventivos', seccion: 'reportes' },
      {
        etiqueta: 'Consultar situación del Servidor Público',
        ruta: '/reportes/situacion-servidor',
        seccion: 'reportes',
      },
      {
        etiqueta: 'Consultar situación Dependencias',
        ruta: '/reportes/situacion-dependencias',
        seccion: 'reportes',
      },
      { etiqueta: 'Reporte General', ruta: '/reportes', seccion: 'reportes' },
      {
        etiqueta: 'Reporte No Obligados',
        ruta: '/reportes/no-obligados',
        seccion: 'reportes',
      },
    ],
  },
  {
    etiqueta: 'Estadísticas',
    hijos: [
      { etiqueta: 'Estadísticas por tipo', ruta: '/estadisticas', seccion: 'estadisticas' },
      {
        etiqueta: 'Situación del Padrón',
        ruta: '/estadisticas/situacion-padron',
        seccion: 'estadisticas',
      },
    ],
  },
  {
    etiqueta: 'Gestión',
    hijos: [
      { etiqueta: 'Libros de cierres', ruta: '/libros-actas', seccion: 'libros-actas' },
      { etiqueta: 'Notificaciones y oficios', ruta: '/oficios', seccion: 'oficios' },
      {
        etiqueta: 'Evoluciones patrimoniales',
        ruta: '/evoluciones-patrimoniales',
        seccion: 'administracion',
      },
      {
        etiqueta: 'Declaración de intereses',
        ruta: '/declaraciones-intereses',
        seccion: 'declaraciones-intereses',
      },
    ],
  },
  {
    etiqueta: 'Administración',
    hijos: [
      {
        etiqueta: 'Creación de usuarios',
        ruta: '/administracion/usuarios',
        seccion: 'administracion',
      },
      {
        etiqueta: 'Movimientos de usuarios',
        ruta: '/administracion/auditoria',
        seccion: 'administracion',
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
