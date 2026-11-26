import type { Sequelize } from 'sequelize-typescript';
import {
  ARBOL_DECLARACION,
  FilasCreadas,
  copiarArbolDeclaracion,
  deshacerCopia,
} from './copiar-declaracion';

type Consulta = { sql: string; replacements: unknown[] };

// Conexión falsa: cada tabla tiene un conjunto de filas hijas y columnas.
function conexionFalsa(filasPorTabla: Record<string, number[]> = {}) {
  const consultas: Consulta[] = [];
  let siguiente = 1000;
  const query = jest.fn(
    (sql: string, opciones: { replacements: unknown[] }) => {
      consultas.push({ sql, replacements: opciones.replacements });
      if (sql.includes('information_schema')) {
        const tabla = String(opciones.replacements[0]);
        const base = ['id', 'created_at', 'updated_at', 'deleted_at', 'nombre'];
        const propias: Record<string, string[]> = {
          domicilios: ['domiciliable_id', 'domiciliable_type'],
          experiencias_laborales: ['experienciable_id', 'experienciable_type'],
          bienes_inmuebles: ['inmuebleable_id', 'inmuebleable_type'],
          vehiculos: ['vehiculosable_id', 'vehiculosable_type'],
          datos_curriculares: ['curricular_id', 'curricular_type'],
        };
        const extra = propias[tabla] ?? ['declaracion_id'];
        return Promise.resolve(
          [...base, ...extra].map((columna) => ({ columna })),
        );
      }
      if (sql.startsWith('SELECT id FROM')) {
        const tabla = /FROM `(\w+)`/.exec(sql)![1];
        // Solo el primer padre consultado de cada tabla tiene filas.
        const ids = filasPorTabla[tabla] ?? [];
        filasPorTabla[tabla] = [];
        return Promise.resolve(ids.map((id) => ({ id })));
      }
      if (sql.startsWith('INSERT')) return Promise.resolve([siguiente++, 1]);
      return Promise.resolve(undefined);
    },
  );
  return { conexion: { query } as unknown as Sequelize, consultas, query };
}

describe('copiarArbolDeclaracion', () => {
  it('cubre las tablas del árbol que copiaba el sistema anterior', () => {
    const tablas = new Set<string>();
    const recorrer = (nodos: typeof ARBOL_DECLARACION) =>
      nodos.forEach((n) => {
        tablas.add(n.tabla);
        recorrer(n.hijos ?? []);
      });
    recorrer(ARBOL_DECLARACION);
    expect([...tablas]).toEqual(
      expect.arrayContaining([
        'domicilios',
        'datos_parejas',
        'experiencias_laborales',
        'dependientes_economicos',
        'adeudos_pasivos',
        'inversiones_cuentas',
        'datos_curriculares',
        'dato_empleo_declarantes',
        'fue_servidor_publicos',
        'bienes_inmuebles',
        'bienes_muebles',
        'vehiculos',
        'prestamo_comodatos',
        'participacion_empresas',
        'participacions',
        'participacion_declaraciones',
        'apoyo_beneficio',
        'representaciones',
        'clientes',
        'beneficios_privados',
        'fideicomisos',
        'donativos',
        'intereses_personals',
        'viajes',
      ]),
    );
  });

  it('copia las filas cambiando el padre y recursivamente a sus hijos', async () => {
    const { conexion, consultas } = conexionFalsa({
      datos_parejas: [50],
      domicilios: [60],
    });
    const creadas: FilasCreadas = new Map();

    await copiarArbolDeclaracion(conexion, 7, 8, creadas);

    // Domicilio de la declaración (tipo App\Declaracion) del padre origen.
    const buscaDomicilio = consultas.find((c) =>
      c.sql.startsWith('SELECT id FROM `domicilios`'),
    )!;
    expect(buscaDomicilio.sql).toContain('`deleted_at` IS NULL');
    expect(buscaDomicilio.replacements).toEqual([7, 'App\\Declaracion']);

    const insertPareja = consultas.find((c) =>
      c.sql.startsWith('INSERT INTO `datos_parejas`'),
    )!;
    expect(insertPareja.sql).toContain('NOW()');
    expect(insertPareja.sql).not.toMatch(/`deleted_at`|`id`,/);
    // Nuevo padre y fila origen.
    expect(insertPareja.replacements).toEqual([8, 50]);

    // Los hijos de la pareja se buscan con el id de la pareja origen (50).
    const hijosPareja = consultas.filter(
      (c) =>
        c.sql.startsWith('SELECT id FROM `domicilios`') &&
        c.replacements[1] === 'App\\DatosPareja',
    );
    expect(hijosPareja[0].replacements[0]).toBe(50);
    expect(creadas.get('datos_parejas')).toEqual([1001]);
    expect(creadas.get('domicilios')?.length).toBeGreaterThan(0);
  });

  it('del préstamo en comodato copia el inmueble solo si tipo_bien_id = 2 y el vehículo solo si = 3', async () => {
    const { conexion, consultas } = conexionFalsa({
      prestamo_comodatos: [70],
    });

    await copiarArbolDeclaracion(conexion, 7, 8, new Map());

    const hijosDe70 = consultas.filter(
      (c) =>
        c.sql.startsWith('SELECT id FROM') &&
        c.sql.includes('prestamo_comodatos` WHERE id = ?'),
    );
    const inmuebles = hijosDe70.find((c) =>
      c.sql.startsWith('SELECT id FROM `bienes_inmuebles`'),
    )!;
    const vehiculos = hijosDe70.find((c) =>
      c.sql.startsWith('SELECT id FROM `vehiculos`'),
    )!;
    expect(inmuebles.sql).toContain('`tipo_bien_id`');
    const tipo = 'App\\PrestamoComodato';
    expect(inmuebles.replacements).toEqual([70, tipo, 70, 2]);
    expect(vehiculos.replacements).toEqual([70, tipo, 70, 3]);
  });

  it('registra lo creado aunque una tabla posterior falle', async () => {
    const { conexion, query } = conexionFalsa({ datos_parejas: [50] });
    const real = query.getMockImplementation()!;
    query.mockImplementation((sql: string, o: { replacements: unknown[] }) =>
      sql.includes('`adeudos_pasivos`') && sql.startsWith('SELECT id')
        ? Promise.reject(new Error('falla'))
        : real(sql, o),
    );
    const creadas: FilasCreadas = new Map();

    await expect(
      copiarArbolDeclaracion(conexion, 7, 8, creadas),
    ).rejects.toThrow('falla');
    expect(creadas.get('datos_parejas')).toEqual([1000]);
  });
});

describe('deshacerCopia', () => {
  it('borra por tabla las filas creadas y limpia el registro', async () => {
    const { conexion, consultas } = conexionFalsa();
    const creadas: FilasCreadas = new Map([
      ['domicilios', [1, 2]],
      ['clientes', []],
      ['viajes', [3]],
    ]);

    await deshacerCopia(conexion, creadas);

    expect(consultas.map((c) => c.sql)).toEqual([
      'DELETE FROM `domicilios` WHERE id IN (?)',
      'DELETE FROM `viajes` WHERE id IN (?)',
    ]);
    expect(consultas[0].replacements).toEqual([[1, 2]]);
    expect(creadas.size).toBe(0);
  });
});
