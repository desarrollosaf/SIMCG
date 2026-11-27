// Motor mínimo de plantillas Blade (Laravel) para las vistas del PDF de declaración.
// Soporta solo lo que usan esas vistas: {{ }}, {!! !!}, {{-- --}}, @if/@elseif/@else/
// @endif, @foreach/@endforeach y @php(...), con el subconjunto de PHP que aparece en
// ellas. Se interpreta (no se genera código): las plantillas son copias literales de
// las vistas del sistema anterior.

import { Coleccion, Modelo } from './valores';
import {
  Expr,
  evaluar,
  parsearExpresion,
  Contexto,
  textoPhp,
  escaparHtml,
} from './php';

export type Nodo =
  | { t: 'texto'; texto: string }
  | { t: 'eco'; expr: Expr; crudo: boolean }
  | { t: 'si'; ramas: { cond: Expr | null; cuerpo: Nodo[] }[] }
  | {
      t: 'para';
      coleccion: Expr;
      clave: string | null;
      variable: string;
      cuerpo: Nodo[];
    }
  | { t: 'php'; expr: Expr }
  | { t: 'captura'; variable: string; cuerpo: Nodo[] };

const DIRECTIVAS = new Set([
  'if',
  'elseif',
  'else',
  'endif',
  'foreach',
  'endforeach',
  'php',
  'capture',
  'endcapture',
]);

const esPalabra = (c: string | undefined) => !!c && /[A-Za-z0-9_]/.test(c);

/** Índice del `)` que cierra el `(` en `desde`, respetando cadenas. */
function cerrarParentesis(fuente: string, desde: number): number {
  let nivel = 0;
  let comilla: string | null = null;
  for (let i = desde; i < fuente.length; i++) {
    const c = fuente[i];
    if (comilla) {
      if (c === '\\') i++;
      else if (c === comilla) comilla = null;
      continue;
    }
    if (c === "'" || c === '"') comilla = c;
    else if (c === '(') nivel++;
    else if (c === ')') {
      nivel--;
      if (nivel === 0) return i;
    }
  }
  throw new Error('Paréntesis sin cerrar en la plantilla');
}

interface Token {
  t: 'texto' | 'eco' | 'crudo' | 'dir';
  valor: string;
  nombre?: string;
}

/** Parte la fuente en texto, ecos y directivas (como el compilador de Blade). */
function tokenizar(fuente: string): Token[] {
  const tokens: Token[] = [];
  let texto = '';
  const vaciar = () => {
    if (texto) tokens.push({ t: 'texto', valor: texto });
    texto = '';
  };
  let i = 0;
  while (i < fuente.length) {
    if (fuente.startsWith('{{--', i)) {
      const fin = fuente.indexOf('--}}', i + 4);
      if (fin < 0) throw new Error('Comentario Blade sin cerrar');
      i = fin + 4;
      continue;
    }
    if (fuente.startsWith('{!!', i)) {
      const fin = fuente.indexOf('!!}', i + 3);
      if (fin < 0) throw new Error('Eco {!! !!} sin cerrar');
      vaciar();
      tokens.push({ t: 'crudo', valor: fuente.slice(i + 3, fin) });
      i = fin + 3;
      continue;
    }
    if (fuente.startsWith('{{', i)) {
      const fin = fuente.indexOf('}}', i + 2);
      if (fin < 0) throw new Error('Eco {{ }} sin cerrar');
      vaciar();
      tokens.push({ t: 'eco', valor: fuente.slice(i + 2, fin) });
      i = fin + 2;
      continue;
    }
    if (fuente[i] === '@' && !esPalabra(fuente[i - 1])) {
      const m = /^@(\w+)/.exec(fuente.slice(i, i + 40));
      const nombre = m?.[1].toLowerCase();
      if (m && nombre && DIRECTIVAS.has(nombre)) {
        vaciar();
        let j = i + m[0].length;
        // Argumentos entre paréntesis (se permiten espacios antes del "(").
        let k = j;
        while (fuente[k] === ' ' || fuente[k] === '\t') k++;
        let args = '';
        if (fuente[k] === '(') {
          const cierre = cerrarParentesis(fuente, k);
          args = fuente.slice(k + 1, cierre);
          j = cierre + 1;
        }
        tokens.push({ t: 'dir', valor: args, nombre });
        i = j;
        continue;
      }
    }
    texto += fuente[i];
    i++;
  }
  vaciar();
  return tokens;
}

/** Compila una plantilla Blade a su árbol de nodos. */
export function compilarBlade(fuente: string): Nodo[] {
  const tokens = tokenizar(fuente);
  let pos = 0;

  const bloque = (
    terminadores: string[],
  ): { nodos: Nodo[]; fin: Token | null } => {
    const nodos: Nodo[] = [];
    while (pos < tokens.length) {
      const tk = tokens[pos];
      if (tk.t === 'dir' && tk.nombre && terminadores.includes(tk.nombre)) {
        return { nodos, fin: tk };
      }
      pos++;
      if (tk.t === 'texto') nodos.push({ t: 'texto', texto: tk.valor });
      else if (tk.t === 'eco' || tk.t === 'crudo') {
        nodos.push({
          t: 'eco',
          expr: parsearExpresion(tk.valor),
          crudo: tk.t === 'crudo',
        });
      } else if (tk.nombre === 'if') {
        const ramas: { cond: Expr | null; cuerpo: Nodo[] }[] = [];
        let cond: Expr | null = parsearExpresion(tk.valor);
        for (;;) {
          const r = bloque(['elseif', 'else', 'endif']);
          ramas.push({ cond, cuerpo: r.nodos });
          if (!r.fin) throw new Error('@if sin @endif');
          pos++;
          if (r.fin.nombre === 'endif') break;
          cond =
            r.fin.nombre === 'elseif' ? parsearExpresion(r.fin.valor) : null;
        }
        nodos.push({ t: 'si', ramas });
      } else if (tk.nombre === 'foreach') {
        const m = /^([\s\S]+?)\s+as\s+\$(\w+)(?:\s*=>\s*\$(\w+))?\s*$/.exec(
          tk.valor,
        );
        if (!m) throw new Error(`@foreach no soportado: ${tk.valor}`);
        const r = bloque(['endforeach']);
        if (!r.fin) throw new Error('@foreach sin @endforeach');
        pos++;
        nodos.push({
          t: 'para',
          coleccion: parsearExpresion(m[1]),
          // `as $k => $v`: m[2] = clave, m[3] = valor; `as $v`: m[2] = valor.
          clave: m[3] ? m[2] : null,
          variable: m[3] ?? m[2],
          cuerpo: r.nodos,
        });
      } else if (tk.nombre === 'capture') {
        const m = /^\s*\$(\w+)\s*$/.exec(tk.valor);
        if (!m) throw new Error(`@capture no soportado: ${tk.valor}`);
        const r = bloque(['endcapture']);
        if (!r.fin) throw new Error('@capture sin @endcapture');
        pos++;
        nodos.push({ t: 'captura', variable: m[1], cuerpo: r.nodos });
      } else if (tk.nombre === 'php') {
        nodos.push({ t: 'php', expr: parsearExpresion(tk.valor) });
      } else {
        throw new Error(`Directiva inesperada @${tk.nombre}`);
      }
    }
    return { nodos, fin: null };
  };

  const raiz = bloque([]);
  return raiz.nodos;
}

/** Renderiza los nodos con las variables dadas (sin escapar lo que ya es HTML). */
export function renderizarNodos(nodos: Nodo[], ctx: Contexto): string {
  let salida = '';
  for (const n of nodos) {
    switch (n.t) {
      case 'texto':
        salida += n.texto;
        break;
      case 'eco': {
        const texto = textoPhp(evaluar(n.expr, ctx));
        salida += n.crudo ? texto : escaparHtml(texto);
        break;
      }
      case 'si': {
        for (const rama of n.ramas) {
          if (rama.cond === null || evaluar(rama.cond, ctx)) {
            salida += renderizarNodos(rama.cuerpo, ctx);
            break;
          }
        }
        break;
      }
      case 'para': {
        const valor = evaluar(n.coleccion, ctx);
        const pares: [string | number, unknown][] =
          valor instanceof Coleccion || Array.isArray(valor)
            ? (valor as unknown[]).map((v, i) => [i, v])
            : valor && typeof valor === 'object' && !(valor instanceof Modelo)
              ? Object.entries(valor)
              : [];
        for (const [clave, v] of pares) {
          ctx.vars[n.variable] = v;
          if (n.clave) ctx.vars[n.clave] = clave;
          salida += renderizarNodos(n.cuerpo, ctx);
        }
        break;
      }
      case 'php':
        evaluar(n.expr, ctx);
        break;
      case 'captura':
        ctx.vars[n.variable] = renderizarNodos(n.cuerpo, ctx);
        break;
    }
  }
  return salida;
}
