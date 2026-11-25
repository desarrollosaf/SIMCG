import { aplanarMenu, esGrupo, menuParaRoles, rutaActiva } from './menu';

const etiquetas = (roles: string[]) => menuParaRoles(roles).map((e) => e.etiqueta);

describe('menuParaRoles', () => {
  it('Administrador ve todo el menú', () => {
    expect(etiquetas(['Administrador'])).toEqual([
      'Inicio',
      'Padrón de obligados',
      'Detección',
      'Estadísticas',
      'Gestión',
      'Administración',
    ]);
  });

  it('Registro solo ve Inicio y Padrón (sin carga No Obligados)', () => {
    const menu = menuParaRoles(['Registro']);
    expect(menu.map((e) => e.etiqueta)).toEqual(['Inicio', 'Padrón de obligados']);
    const padron = menu[1];
    expect(esGrupo(padron) && padron.hijos.map((h) => h.ruta)).toEqual(['/servidores', '/cargas']);
  });

  it('Consulta ve Detección y Estadísticas pero no Gestión ni Administración', () => {
    const nombres = etiquetas(['Consulta']);
    expect(nombres).toContain('Detección');
    expect(nombres).toContain('Estadísticas');
    expect(nombres).not.toContain('Gestión');
    expect(nombres).not.toContain('Administración');
  });

  it('sin roles no hay menú', () => {
    expect(menuParaRoles(null)).toEqual([]);
    expect(menuParaRoles([])).toEqual([]);
  });

  it('aplanarMenu conserva el grupo de cada destino', () => {
    const planas = aplanarMenu(menuParaRoles(['Administrador']));
    expect(planas[0].ruta).toBe('/home');
    expect(planas[0].grupo).toBeNull();
    expect(planas.find((h) => h.ruta === '/cargas')?.grupo).toBe('Padrón de obligados');
  });
});

describe('rutaActiva', () => {
  const hojas = aplanarMenu(menuParaRoles(['Administrador']));

  it('elige la ruta más específica', () => {
    expect(rutaActiva('/cargas/no-obligados', hojas)).toBe('/cargas/no-obligados');
    expect(rutaActiva('/cargas', hojas)).toBe('/cargas');
    expect(rutaActiva('/servidores/12/movimientos?x=1', hojas)).toBe('/servidores');
  });

  it('no coincide por prefijo parcial', () => {
    expect(rutaActiva('/serviciosx', hojas)).toBeNull();
  });
});
