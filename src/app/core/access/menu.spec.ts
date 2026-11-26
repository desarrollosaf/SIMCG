import { MENU, aplanarMenu, esGrupo, menuParaRoles, rutaActiva } from './menu';

const etiquetas = (roles: string[]) => menuParaRoles(roles).map((e) => e.etiqueta);

describe('menuParaRoles', () => {
  it('Administrador ve todo el menú', () => {
    expect(etiquetas(['Administrador'])).toEqual([
      'Inicio',
      'Análisis de evoluciones patrimoniales',
      'Padrón de obligados',
      'Declaraciones',
      'Detección de omisos',
      'Reportes',
      'Estadísticas por tipo',
      'Notificaciones',
      'Administración',
    ]);
  });

  it('Registro solo ve Inicio y Padrón (sin carga No Obligados)', () => {
    const menu = menuParaRoles(['Registro']);
    expect(menu.map((e) => e.etiqueta)).toEqual(['Inicio', 'Padrón de obligados']);
    const padron = menu[1];
    expect(esGrupo(padron) && padron.hijos.map((h) => h.ruta)).toEqual(['/servidores', '/cargas']);
  });

  it('Consulta ve detección, reportes y estadísticas pero no Notificaciones ni Administración', () => {
    const nombres = etiquetas(['Consulta']);
    expect(nombres).toContain('Detección de omisos');
    expect(nombres).toContain('Reportes');
    expect(nombres).toContain('Estadísticas por tipo');
    expect(nombres).not.toContain('Notificaciones');
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
    expect(rutaActiva('/reportes/omisos', hojas)).toBe('/reportes/omisos');
    expect(rutaActiva('/reportes', hojas)).toBe('/reportes');
    expect(rutaActiva('/cargas/no-obligados', hojas)).toBe('/cargas');
    expect(rutaActiva('/servidores/12/movimientos?x=1', hojas)).toBe('/servidores');
  });

  it('no coincide por prefijo parcial', () => {
    expect(rutaActiva('/serviciosx', hojas)).toBeNull();
  });
});

describe('nombres cortos del menú colapsado', () => {
  it('las entradas sin grupo traen nombre corto de una palabra', () => {
    const hojas = MENU.filter((e) => !esGrupo(e));
    const cortos = Object.fromEntries(hojas.map((h) => [h.etiqueta, h.corto]));
    expect(cortos['Análisis de evoluciones patrimoniales']).toBe('Evoluciones');
    expect(cortos['Estadísticas por tipo']).toBe('Estadísticas');
    expect(cortos['Notificaciones']).toBe('Notificaciones');
    expect(cortos['Inicio']).toBe('Inicio');
  });

  it('todos los grupos tienen nombre corto y el buscador conserva la etiqueta completa', () => {
    expect(MENU.filter(esGrupo).every((g) => !!g.corto)).toBe(true);
    const planas = aplanarMenu(menuParaRoles(['Administrador']));
    expect(planas.map((h) => h.etiqueta)).toContain('Análisis de evoluciones patrimoniales');
  });
});
