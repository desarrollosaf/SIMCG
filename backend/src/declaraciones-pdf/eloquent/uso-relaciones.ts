import type { Nodo } from '../blade/blade';
import { cadenasDe, Expr } from '../blade/php';
import { CATALOGO } from './catalogo';
import type { Arbol } from './tipos';

interface Alcance {
  raiz: string;
  camino: string[];
  clase: string;
}

/** Fusiona `origen` dentro de `destino` (unión de árboles de relaciones). */
export function unirArboles(destino: Arbol, origen: Arbol): Arbol {
  for (const [rel, sub] of Object.entries(origen)) {
    destino[rel] = unirArboles(destino[rel] ?? {}, sub);
  }
  return destino;
}

/**
 * Recorre una plantilla y devuelve, por variable raíz ($declaracion, $servidor), las
 * relaciones que la plantilla alcanza con `->`. Reproduce la carga perezosa de Eloquent
 * pero por adelantado: la plantilla se interpreta de forma síncrona.
 *
 * `raices` da la clase del modelo de cada variable raíz.
 */
export function relacionesUsadas(
  nodos: Nodo[],
  raices: Record<string, string>,
  alAtributo?: (clase: string, atributo: string) => void,
): Record<string, Arbol> {
  const arboles: Record<string, Arbol> = Object.fromEntries(
    Object.keys(raices).map((r) => [r, {}]),
  );
  const variables = new Map<string, Alcance>(
    Object.entries(raices).map(([raiz, clase]) => [
      raiz,
      { raiz, camino: [], clase },
    ]),
  );

  // Camina una cadena `$var->a->b`; devuelve el alcance si termina en una relación.
  const caminar = (raiz: string, ruta: string[]): Alcance | null => {
    const inicio = variables.get(raiz);
    if (!inicio) return null;
    let { clase } = inicio;
    const camino = [...inicio.camino];
    let nodo = arboles[inicio.raiz];
    for (const base of camino) nodo = nodo[base];
    let terminaEnRelacion = true;
    for (const segmento of ruta) {
      const rel = CATALOGO[clase]?.relaciones[segmento.toLowerCase()];
      if (!rel) {
        alAtributo?.(clase, segmento);
        terminaEnRelacion = false;
        break;
      }
      const clave = segmento.toLowerCase();
      nodo[clave] ??= {};
      nodo = nodo[clave];
      camino.push(clave);
      clase = rel.destino;
    }
    return terminaEnRelacion && ruta.length > 0
      ? { raiz: inicio.raiz, camino, clase }
      : ruta.length === 0
        ? inicio
        : null;
  };

  const visitarExpr = (e: Expr) => {
    for (const { raiz, ruta } of cadenasDe(e)) caminar(raiz, ruta);
  };

  const visitar = (lista: Nodo[]) => {
    for (const n of lista) {
      switch (n.t) {
        case 'eco':
        case 'php':
          visitarExpr(n.expr);
          break;
        case 'captura':
          visitar(n.cuerpo);
          break;
        case 'si':
          for (const r of n.ramas) {
            if (r.cond) visitarExpr(r.cond);
            visitar(r.cuerpo);
          }
          break;
        case 'para': {
          visitarExpr(n.coleccion);
          const cadenas = cadenasDe(n.coleccion);
          const alcance =
            cadenas.length === 1
              ? caminar(cadenas[0].raiz, cadenas[0].ruta)
              : null;
          const previo = variables.get(n.variable);
          if (alcance) variables.set(n.variable, alcance);
          else variables.delete(n.variable);
          visitar(n.cuerpo);
          if (previo) variables.set(n.variable, previo);
          else variables.delete(n.variable);
          break;
        }
        default:
          break;
      }
    }
  };
  visitar(nodos);
  return arboles;
}
