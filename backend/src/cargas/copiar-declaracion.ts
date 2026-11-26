import { QueryTypes } from 'sequelize';
import type { Sequelize } from 'sequelize-typescript';

// Árbol de datos del declarante que cuelga de una declaración en declaranet.
// Réplica de lo que copiaba ServidorPulicoImport del sistema anterior al crear
// un movimiento nuevo a partir del anterior. Las tablas se copian con SQL
// (INSERT ... SELECT) porque SIMCG no mapea esos modelos: solo se duplican filas.
export interface NodoCopia {
  tabla: string;
  // Columna que apunta al padre (declaracion_id o la del par polimórfico).
  columna: string;
  // Relaciones polimórficas: columna y valor del tipo del padre.
  tipoColumna?: string;
  tipoPadre?: string;
  // Solo se copia si la fila padre tiene `columna` = `valor` (ej. el tipo de bien).
  siPadre?: { tabla: string; columna: string; valor: number };
  hijos?: NodoCopia[];
}

const T_DECLARACION = 'App\\Declaracion';

const porDeclaracion = (tabla: string, hijos?: NodoCopia[]): NodoCopia => ({
  tabla,
  columna: 'declaracion_id',
  hijos,
});

const domicilio = (tipoPadre: string): NodoCopia => ({
  tabla: 'domicilios',
  columna: 'domiciliable_id',
  tipoColumna: 'domiciliable_type',
  tipoPadre,
});

const experiencia = (tipoPadre: string): NodoCopia => ({
  tabla: 'experiencias_laborales',
  columna: 'experienciable_id',
  tipoColumna: 'experienciable_type',
  tipoPadre,
});

// En el sistema anterior un préstamo en comodato solo copiaba su inmueble si
// tipo_bien_id = 2, y su vehículo si tipo_bien_id = 3.
const TIPO_BIEN_INMUEBLE = 2;
const TIPO_BIEN_VEHICULO = 3;
const delPrestamo = (valor: number) => ({
  tabla: 'prestamo_comodatos',
  columna: 'tipo_bien_id',
  valor,
});

const inmueble = (
  tipoPadre: string,
  siPadre?: NodoCopia['siPadre'],
): NodoCopia => ({
  tabla: 'bienes_inmuebles',
  columna: 'inmuebleable_id',
  tipoColumna: 'inmuebleable_type',
  tipoPadre,
  siPadre,
  hijos: [domicilio('App\\BienInmueble')],
});

const vehiculo = (
  tipoPadre: string,
  siPadre?: NodoCopia['siPadre'],
): NodoCopia => ({
  tabla: 'vehiculos',
  columna: 'vehiculosable_id',
  tipoColumna: 'vehiculosable_type',
  tipoPadre,
  siPadre,
});

export const ARBOL_DECLARACION: NodoCopia[] = [
  domicilio(T_DECLARACION),
  porDeclaracion('datos_parejas', [
    experiencia('App\\DatosPareja'),
    domicilio('App\\DatosPareja'),
  ]),
  porDeclaracion('dependientes_economicos', [
    experiencia('App\\DependienteEconomico'),
    domicilio('App\\DependienteEconomico'),
  ]),
  porDeclaracion('adeudos_pasivos'),
  porDeclaracion('inversiones_cuentas'),
  {
    tabla: 'datos_curriculares',
    columna: 'curricular_id',
    tipoColumna: 'curricular_type',
    tipoPadre: T_DECLARACION,
  },
  porDeclaracion('dato_empleo_declarantes'),
  experiencia(T_DECLARACION),
  porDeclaracion('fue_servidor_publicos'),
  inmueble(T_DECLARACION),
  porDeclaracion('bienes_muebles'),
  vehiculo(T_DECLARACION),
  porDeclaracion('prestamo_comodatos', [
    inmueble('App\\PrestamoComodato', delPrestamo(TIPO_BIEN_INMUEBLE)),
    vehiculo('App\\PrestamoComodato', delPrestamo(TIPO_BIEN_VEHICULO)),
  ]),
  porDeclaracion('participacion_empresas'),
  porDeclaracion('participacions'),
  porDeclaracion('participacion_declaraciones'),
  porDeclaracion('apoyo_beneficio'),
  porDeclaracion('representaciones'),
  porDeclaracion('clientes'),
  porDeclaracion('beneficios_privados'),
  porDeclaracion('fideicomisos'),
  porDeclaracion('donativos'),
  porDeclaracion('intereses_personals', [
    experiencia('App\\InteresesPersonal'),
  ]),
  porDeclaracion('viajes'),
];

// Filas creadas por tabla; sirve para deshacer la copia (MyISAM no tiene transacciones).
export type FilasCreadas = Map<string, number[]>;

// Nombres que vienen de information_schema (pueden llevar acentos o ñ); solo se
// descartan los caracteres que romperían el entrecomillado con acento grave.
const IDENTIFICADOR = /^[^`\\\0]+$/;
const FECHAS_AUTOMATICAS = ['created_at', 'updated_at'];
const NO_COPIAR = ['id', 'deleted_at'];

const ident = (nombre: string): string => {
  if (!IDENTIFICADOR.test(nombre)) {
    throw new Error(`Identificador no permitido: ${nombre}`);
  }
  return `\`${nombre}\``;
};

/**
 * Duplica el árbol del declarante de la declaración `origenId` hacia
 * `destinoId`. Las filas dadas de baja (deleted_at) no se copian y las fechas
 * de creación/actualización son las del momento de la copia.
 */
export async function copiarArbolDeclaracion(
  conexion: Sequelize,
  origenId: number,
  destinoId: number,
  creadas: FilasCreadas,
): Promise<void> {
  const columnasPorTabla = new Map<string, string[]>();

  const columnasDe = async (tabla: string): Promise<string[]> => {
    const guardadas = columnasPorTabla.get(tabla);
    if (guardadas) return guardadas;
    const filas = await conexion.query<{ columna: string }>(
      `SELECT column_name AS columna FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = ?
       ORDER BY ordinal_position`,
      { replacements: [tabla], type: QueryTypes.SELECT },
    );
    const columnas = filas.map((f) => f.columna);
    columnasPorTabla.set(tabla, columnas);
    return columnas;
  };

  const copiarNodo = async (
    nodo: NodoCopia,
    padreOrigen: number,
    padreDestino: number,
  ): Promise<void> => {
    const columnas = await columnasDe(nodo.tabla);
    if (!columnas.includes(nodo.columna)) {
      throw new Error(`La tabla ${nodo.tabla} no tiene ${nodo.columna}`);
    }

    const condiciones = [`${ident(nodo.columna)} = ?`];
    const valores: (string | number)[] = [padreOrigen];
    if (nodo.tipoColumna && nodo.tipoPadre) {
      condiciones.push(`${ident(nodo.tipoColumna)} = ?`);
      valores.push(nodo.tipoPadre);
    }
    if (nodo.siPadre) {
      condiciones.push(
        `(SELECT ${ident(nodo.siPadre.columna)} FROM ${ident(nodo.siPadre.tabla)} WHERE id = ?) = ?`,
      );
      valores.push(padreOrigen, nodo.siPadre.valor);
    }
    if (columnas.includes('deleted_at'))
      condiciones.push('`deleted_at` IS NULL');

    const origenes = await conexion.query<{ id: number }>(
      `SELECT id FROM ${ident(nodo.tabla)} WHERE ${condiciones.join(' AND ')} ORDER BY id`,
      { replacements: valores, type: QueryTypes.SELECT },
    );

    const copiables = columnas.filter((c) => !NO_COPIAR.includes(c));
    const destino = copiables.map(ident).join(', ');
    const origen = copiables
      .map((c) => {
        if (c === nodo.columna) return '?';
        if (FECHAS_AUTOMATICAS.includes(c)) return 'NOW()';
        return ident(c);
      })
      .join(', ');

    for (const { id } of origenes) {
      const [nuevoId] = await conexion.query(
        `INSERT INTO ${ident(nodo.tabla)} (${destino})
         SELECT ${origen} FROM ${ident(nodo.tabla)} WHERE id = ?`,
        { replacements: [padreDestino, id], type: QueryTypes.INSERT },
      );
      const creado = Number(nuevoId);
      const lista = creadas.get(nodo.tabla) ?? [];
      lista.push(creado);
      creadas.set(nodo.tabla, lista);

      for (const hijo of nodo.hijos ?? []) {
        await copiarNodo(hijo, id, creado);
      }
    }
  };

  for (const nodo of ARBOL_DECLARACION) {
    await copiarNodo(nodo, origenId, destinoId);
  }
}

// Borra las filas creadas por una copia que no llegó a buen término.
export async function deshacerCopia(
  conexion: Sequelize,
  creadas: FilasCreadas,
): Promise<void> {
  for (const [tabla, ids] of creadas) {
    if (ids.length === 0) continue;
    await conexion.query(`DELETE FROM ${ident(tabla)} WHERE id IN (?)`, {
      replacements: [ids],
      type: QueryTypes.DELETE,
    });
  }
  creadas.clear();
}
