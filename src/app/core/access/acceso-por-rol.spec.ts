import {
  ROLES_SIMCG,
  Seccion,
  puedeEditarServidores,
  puedeEliminarMovimientos,
  puedeVer,
} from './acceso-por-rol';

describe('acciones de Servidores', () => {
  it('solo Administrador y Registro editan servidores', () => {
    expect(ROLES_SIMCG.filter((r) => puedeEditarServidores([r]))).toEqual([
      'Administrador',
      'Registro',
    ]);
    expect(puedeEditarServidores(null)).toBe(false);
  });

  it('solo Administrador y Consulta eliminan movimientos', () => {
    expect(ROLES_SIMCG.filter((r) => puedeEliminarMovimientos([r]))).toEqual([
      'Administrador',
      'Consulta',
    ]);
    expect(puedeEliminarMovimientos([])).toBe(false);
  });
});

describe('puedeVer', () => {
  const todas: Seccion[] = [
    'servidores',
    'cargas',
    'libros-actas',
    'reportes',
    'declaraciones',
    'oficios',
    'declaraciones-intereses',
    'estadisticas',
    'administracion',
  ];

  it('Administrador ve todo', () => {
    for (const seccion of todas) {
      expect(puedeVer(['Administrador'], seccion)).toBe(true);
    }
  });

  it('Registro ve solo Servidores y Cargas', () => {
    const visibles = todas.filter((s) => puedeVer(['Registro'], s));
    expect(visibles).toEqual(['servidores', 'cargas']);
  });

  it.each(['Consulta', 'Estadistica', 'Estadistica2'])(
    '%s ve Servidores, Reportes, Declaraciones y Estadísticas',
    (rol) => {
      const visibles = todas.filter((s) => puedeVer([rol], s));
      expect(visibles).toEqual(['servidores', 'reportes', 'declaraciones', 'estadisticas']);
    },
  );

  it('sin roles o con un rol desconocido no ve nada', () => {
    for (const seccion of todas) {
      expect(puedeVer([], seccion)).toBe(false);
      expect(puedeVer(null, seccion)).toBe(false);
      expect(puedeVer(['usuario'], seccion)).toBe(false);
    }
  });

  it('expone los cinco roles de la base', () => {
    expect([...ROLES_SIMCG]).toEqual([
      'Administrador',
      'Registro',
      'Consulta',
      'Estadistica',
      'Estadistica2',
    ]);
  });
});
