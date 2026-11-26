import { compilarBlade } from '../blade/blade';
import { Coleccion, Modelo } from '../blade/valores';
import { CargadorEloquent } from './cargador';
import { CATALOGO } from './catalogo.generado';
import { relacionesUsadas, unirArboles } from './uso-relaciones';

type Fila = Record<string, unknown>;

/** Base falsa: responde por tabla; registra el SQL y los parámetros. */
function baseFalsa(tablas: Record<string, Fila[]>) {
  const llamadas: { sql: string; replacements: Record<string, unknown> }[] = [];
  const query = jest.fn(
    (sql: string, opciones: { replacements?: Record<string, unknown> }) => {
      if (sql.includes('information_schema')) {
        return Promise.resolve([
          { t: 'declaraciones', c: 'fecha_declaracion', d: 'date' },
          { t: 'declaraciones', c: 'created_at', d: 'timestamp' },
        ]);
      }
      llamadas.push({ sql, replacements: opciones.replacements ?? {} });
      const tabla = /FROM `(\w+)`/.exec(sql)?.[1] ?? '';
      return Promise.resolve(tablas[tabla] ?? []);
    },
  );
  return { query, llamadas };
}

describe('CargadorEloquent', () => {
  const crear = (
    principal: Record<string, Fila[]>,
    declaranet: Record<string, Fila[]>,
  ) => {
    const p = baseFalsa(principal);
    const d = baseFalsa(declaranet);
    return { cargador: new CargadorEloquent(p as never, d as never), p, d };
  };

  it('carga belongsTo, hasMany y morphOne con sus llaves y el borrado lógico', async () => {
    const { cargador, d, p } = crear(
      { tipo_movimientos_mcg: [{ id: 3, valor: 'MODIFICACION' }] },
      {
        declaraciones: [
          {
            id: 5,
            servidor_publico_id: 1,
            tipo_movimiento_id: 3,
            fecha_declaracion: new Date(Date.UTC(2024, 2, 9)),
            created_at: new Date(Date.UTC(2024, 2, 9, 10, 5, 7)),
          },
        ],
        datos_curriculares: [
          { id: 9, curricular_id: 5, carrera_area: 'B' },
          { id: 8, curricular_id: 5, carrera_area: 'A' },
        ],
        domicilios: [{ id: 2, domiciliable_id: 5, calle: 'X' }],
      },
    );
    const declaracion = await cargador.buscar(
      'Declaracion',
      { id: 5, servidor_publico_id: 1 },
      { tipo_movimiento: {}, datos_curriculares: {}, domicilio: {} },
    );
    expect(declaracion).toBeInstanceOf(Modelo);
    // Las fechas llegan como texto, igual que con PDO.
    expect(declaracion?.atributos['fecha_declaracion']).toBe('2024-03-09');
    expect(declaracion?.atributos['created_at']).toBe('2024-03-09 10:05:07');
    const tipo = declaracion?.leer('tipo_movimiento') as Modelo;
    expect(tipo.atributos['valor']).toBe('MODIFICACION');
    const hijos = declaracion?.leer('datos_curriculares');
    expect(hijos).toBeInstanceOf(Coleccion);
    expect((hijos as Modelo[]).map((h) => h.atributos['carrera_area'])).toEqual(
      ['B', 'A'],
    );
    expect((declaracion?.leer('domicilio') as Modelo).atributos['calle']).toBe(
      'X',
    );

    const sql = d.llamadas.map((l) => l.sql).join('\n');
    expect(sql).toContain(
      'FROM `declaraciones` WHERE `id` = :id AND `servidor_publico_id` = :servidor_publico_id AND `deleted_at` IS NULL',
    );
    expect(sql).toContain(
      'FROM `datos_curriculares` WHERE `curricular_id` IN (:valores) AND `curricular_type` = :tipoValor AND `deleted_at` IS NULL',
    );
    const morph = d.llamadas.find((l) => l.sql.includes('`domicilios`'));
    expect(morph?.replacements['tipoValor']).toBe('App\\Declaracion');
    expect(morph?.replacements['valores']).toEqual([5]);
    expect(p.llamadas.map((l) => l.sql).join()).toContain(
      'FROM `tipo_movimientos_mcg` WHERE `id` IN (:valores) AND `deleted_at` IS NULL',
    );
  });

  it('sin fila queda null (uno) o colección vacía (varios) y no consulta con FK nula', async () => {
    const { cargador, d } = crear(
      {},
      {
        declaraciones: [
          { id: 5, servidor_publico_id: 1, tipo_movimiento_id: null },
        ],
      },
    );
    const declaracion = await cargador.buscar(
      'Declaracion',
      { id: 5 },
      { tipo_movimiento: {}, viajes: {}, pareja: {} },
    );
    expect(declaracion?.leer('tipo_movimiento')).toBeNull();
    expect(declaracion?.leer('pareja')).toBeNull();
    expect(declaracion?.leer('viajes')).toBeInstanceOf(Coleccion);
    expect(declaracion?.leer('viajes')).toHaveLength(0);
    expect(d.llamadas.some((l) => l.sql.includes('tipo_movimientos_mcg'))).toBe(
      false,
    );
  });

  it('el servidor y sus catálogos salen de la base principal', async () => {
    const { cargador, p, d } = crear(
      {
        servidores_publicos: [{ id: 1, nombre: 'ANA', tipo_dependencia: 2 }],
        tipo_dependencia: [{ id: 2, nombre: 'LEGISLATURA' }],
      },
      {},
    );
    const servidor = await cargador.buscar(
      'ServidorPublico',
      { id: 1 },
      { nombredependencia: {} },
    );
    expect(
      (servidor?.leer('nombreDependencia') as Modelo).atributos['nombre'],
    ).toBe('LEGISLATURA');
    expect(p.llamadas).toHaveLength(2);
    expect(d.llamadas).toHaveLength(0);
  });

  it('cada modelo usa su conexión: mysql2 declara declaranet y sin $connection va a la principal', async () => {
    const principales = Object.entries(CATALOGO)
      .filter(([, m]) => m.conexion === 'principal')
      .map(([clase]) => clase)
      .sort();
    expect(principales).toEqual([
      'Folio',
      'Respuesta',
      'ServidorPublico',
      'TipoCorreo',
      'TipoMovimientoMCG',
      'tipoDepartamento',
      'tipoDependencia',
      'tipoDireccion',
    ]);
    expect(CATALOGO['Declaracion'].conexion).toBe('declaranet');

    const { cargador, p, d } = crear(
      {
        tipo_movimientos_mcg: [{ id: 4, valor: 'CONCLUSION' }],
      },
      {
        declaraciones: [
          { id: 5, servidor_publico_id: 1, tipo_movimiento_id: 4 },
        ],
        tipo_movimientos_mcg: [{ id: 4, valor: 'CONCLUSIÓN' }],
      },
    );
    const declaracion = await cargador.buscar(
      'Declaracion',
      { id: 5 },
      { tipo_movimiento: {} },
    );
    const tipo = declaracion?.leer('tipo_movimiento') as Modelo;
    expect(tipo.atributos['valor']).toBe('CONCLUSION');
    expect(p.llamadas.map((l) => l.sql).join()).toContain(
      'tipo_movimientos_mcg',
    );
    expect(d.llamadas.map((l) => l.sql).join()).not.toContain(
      'tipo_movimientos_mcg',
    );
  });

  it('devuelve null si la fila no existe y rechaza modelos o columnas fuera del catálogo', async () => {
    const { cargador } = crear({}, {});
    expect(await cargador.buscar('Declaracion', { id: 1 }, {})).toBeNull();
    await expect(cargador.buscar('Inventado', { id: 1 }, {})).rejects.toThrow(
      'Modelo sin catálogo',
    );
    await expect(
      cargador.buscar('Declaracion', { 'id; DROP': 1 }, {}),
    ).rejects.toThrow('Columna no válida');
  });
});

describe('relacionesUsadas', () => {
  const arbolDe = (fuente: string) =>
    relacionesUsadas(compilarBlade(fuente), {
      declaracion: 'Declaracion',
      servidor: 'ServidorPublico',
    });

  it('sigue las relaciones que alcanza la plantilla, también dentro de @foreach', () => {
    const { declaracion, servidor } = arbolDe(
      '@foreach($declaracion->bienes_inmuebles as $item) {{ $item->tipoInmueble->valor }} {{ $item->domicilio->entidad_domicilio->entidad }} @endforeach {{ $servidor->nombreDependencia->nombre }} {{ $declaracion->pais->valor }}',
    );
    expect(declaracion['bienes_inmuebles']['tipoinmueble']).toEqual({});
    expect(
      declaracion['bienes_inmuebles']['domicilio']['entidad_domicilio'],
    ).toEqual({});
    expect(declaracion['pais']).toEqual({});
    expect(servidor['nombredependencia']).toEqual({});
  });

  it('ignora atributos y avisa de los que no son relación', () => {
    const vistos: string[] = [];
    const { declaracion } = relacionesUsadas(
      compilarBlade(
        '{{ $declaracion->cargo }} {{ $declaracion->pareja->nada }}',
      ),
      { declaracion: 'Declaracion' },
      (clase, atributo) => vistos.push(`${clase}.${atributo}`),
    );
    expect(Object.keys(declaracion)).toEqual(['pareja']);
    expect(vistos).toEqual(['Declaracion.cargo', 'DatosPareja.nada']);
  });

  it('unirArboles combina ramas sin perder ninguna', () => {
    expect(unirArboles({ a: { b: {} } }, { a: { c: {} }, d: {} })).toEqual({
      a: { b: {}, c: {} },
      d: {},
    });
  });
});
