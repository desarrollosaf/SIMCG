export type TipoRelacion =
  'belongsTo' | 'hasOne' | 'hasMany' | 'morphOne' | 'morphMany';

export interface RelacionMeta {
  /** Nombre del método tal como está en el modelo (la búsqueda ignora mayúsculas). */
  nombre: string;
  tipo: TipoRelacion;
  /** Clase del modelo relacionado (clave de CATALOGO). */
  destino: string;
  /** belongsTo: columna FK de este modelo. hasOne/hasMany/morph*: columna local (llave). */
  claveLocal: string;
  /** belongsTo: llave del destino. hasOne/hasMany/morph*: columna FK del destino. */
  claveDestino: string;
  /** Solo morph*: columna con el tipo del padre y su valor (p. ej. "App\Declaracion"). */
  tipoColumna?: string;
  tipoValor?: string;
}

export interface ModeloMeta {
  tabla: string;
  /** Conexión de Laravel: `$connection = "mysql2"` es declaranet; sin $connection, la principal. */
  conexion: 'principal' | 'declaranet';
  soft: boolean;
  pk: string;
  /** Relaciones indexadas por nombre en minúsculas. */
  relaciones: Record<string, RelacionMeta>;
}

/** Árbol de relaciones a precargar: nombre en minúsculas -> subárbol. */
export interface Arbol {
  [relacion: string]: Arbol;
}
