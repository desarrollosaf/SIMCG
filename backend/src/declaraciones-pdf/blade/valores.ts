// Valores que ven las plantillas: modelos "Eloquent" (atributos + relaciones ya
// cargadas) y colecciones. Replican la semántica de lectura de Eloquent.

/** Colección Eloquent: siempre verdadera como objeto, aunque esté vacía. */
export class Coleccion<T = unknown> extends Array<T> {}

/** Fila de BD con sus relaciones cargadas (equivale a un modelo Eloquent). */
export class Modelo {
  readonly relaciones = new Map<string, unknown>();

  constructor(
    readonly clase: string,
    readonly atributos: Record<string, unknown>,
  ) {}

  /** Eloquent: primero el atributo (clave exacta), luego la relación (sin distinguir mayúsculas). */
  leer(clave: string): unknown {
    if (Object.hasOwn(this.atributos, clave)) return this.atributos[clave];
    const rel = this.relaciones.get(clave.toLowerCase());
    return rel === undefined ? null : rel;
  }
}

/** `$a->clave` con null seguro: lo inexistente es null. */
export function propiedad(objeto: unknown, clave: string): unknown {
  if (objeto === null || objeto === undefined) return null;
  if (objeto instanceof Modelo) return objeto.leer(clave);
  if (typeof objeto === 'object') {
    const valor = (objeto as Record<string, unknown>)[clave];
    return valor === undefined ? null : valor;
  }
  return null;
}
