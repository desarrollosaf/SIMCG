// Subconjunto de PHP que usan las vistas del PDF: variables, propiedades (->),
// comparaciones, lógicos, concatenación, ternario y unas pocas funciones. Las
// comparaciones y la verdad de los valores siguen las reglas de PHP 8.

import { Coleccion, propiedad } from './valores';

export type Expr =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'var'; n: string }
  | { k: 'const'; n: string }
  | { k: 'prop'; o: Expr; n: string }
  | { k: 'llamada'; n: string; a: Expr[] }
  | { k: 'estatica'; c: string; m: string; a: Expr[] }
  | { k: 'metodo'; o: Expr; n: string; a: Expr[] }
  | { k: 'un'; op: '!' | '-'; e: Expr }
  | { k: 'bin'; op: string; l: Expr; r: Expr }
  | { k: 'ter'; c: Expr; a: Expr | null; b: Expr }
  | { k: 'asig'; n: string; e: Expr };

export interface Contexto {
  vars: Record<string, unknown>;
  /** Equivale a `session('clave')` del sistema anterior. */
  sesion: Record<string, unknown>;
}

// ---------------------------------------------------------------- léxico

type Tok =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'var'; v: string }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string };

const OPERADORES = [
  '===',
  '!==',
  '==',
  '!=',
  '<=',
  '>=',
  '&&',
  '||',
  '->',
  '::',
  '<',
  '>',
  '!',
  '.',
  '+',
  '-',
  '*',
  '/',
  '%',
  '?',
  ':',
  '(',
  ')',
  ',',
  '=',
];

function lexer(fuente: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < fuente.length) {
    const c = fuente[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === "'" || c === '"') {
      let valor = '';
      i++;
      while (i < fuente.length && fuente[i] !== c) {
        if (
          fuente[i] === '\\' &&
          (fuente[i + 1] === c || fuente[i + 1] === '\\')
        ) {
          valor += fuente[i + 1];
          i += 2;
        } else {
          if (c === '"' && fuente[i] === '$') {
            throw new Error(`Interpolación no soportada en: ${fuente}`);
          }
          valor += fuente[i++];
        }
      }
      i++;
      toks.push({ t: 'str', v: valor });
      continue;
    }
    const num = /^\d+(\.\d+)?/.exec(fuente.slice(i));
    if (num) {
      toks.push({ t: 'num', v: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    if (c === '$') {
      const m = /^\$([\p{L}_][\p{L}\p{N}_]*)/u.exec(fuente.slice(i));
      if (!m) throw new Error(`Variable inválida en: ${fuente}`);
      toks.push({ t: 'var', v: m[1] });
      i += m[0].length;
      continue;
    }
    const id = /^\\?[\p{L}_][\p{L}\p{N}_\\]*/u.exec(fuente.slice(i));
    if (id) {
      toks.push({ t: 'id', v: id[0] });
      i += id[0].length;
      continue;
    }
    const op = OPERADORES.find((o) => fuente.startsWith(o, i));
    if (!op) throw new Error(`Carácter no soportado "${c}" en: ${fuente}`);
    toks.push({ t: 'op', v: op });
    i += op.length;
  }
  return toks;
}

// ---------------------------------------------------------------- sintaxis

// Mayor número, mayor precedencia. En PHP 8 `+`/`-` ligan más que `.`.
const PRECEDENCIA: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '==': 3,
  '!=': 3,
  '===': 3,
  '!==': 3,
  '<': 4,
  '<=': 4,
  '>': 4,
  '>=': 4,
  '.': 5,
  '+': 6,
  '-': 6,
  '*': 7,
  '/': 7,
  '%': 7,
};

export function parsearExpresion(fuente: string): Expr {
  const toks = lexer(fuente);
  let p = 0;
  const sig = () => toks[p];
  const esOp = (v: string) => sig()?.t === 'op' && sig().v === v;
  const consumir = (v: string) => {
    if (!esOp(v)) throw new Error(`Se esperaba "${v}" en: ${fuente}`);
    p++;
  };

  const argumentos = (): Expr[] => {
    consumir('(');
    const args: Expr[] = [];
    if (!esOp(')')) {
      for (;;) {
        args.push(expresion());
        if (esOp(',')) p++;
        else break;
      }
    }
    consumir(')');
    return args;
  };

  const primario = (): Expr => {
    const tk = sig();
    if (!tk) throw new Error(`Expresión incompleta: ${fuente}`);
    let e: Expr;
    if (tk.t === 'num') {
      p++;
      e = { k: 'num', v: tk.v };
    } else if (tk.t === 'str') {
      p++;
      e = { k: 'str', v: tk.v };
    } else if (tk.t === 'var') {
      p++;
      e = { k: 'var', n: tk.v };
    } else if (tk.t === 'id') {
      p++;
      if (esOp('::')) {
        p++;
        const m = sig();
        if (m?.t !== 'id')
          throw new Error(`Método estático inválido: ${fuente}`);
        p++;
        e = {
          k: 'estatica',
          c: tk.v.replace(/^\\/, ''),
          m: m.v,
          a: argumentos(),
        };
      } else if (esOp('(')) {
        e = { k: 'llamada', n: tk.v, a: argumentos() };
      } else {
        e = { k: 'const', n: tk.v };
      }
    } else if (tk.t === 'op' && tk.v === '(') {
      p++;
      e = expresion();
      consumir(')');
    } else if (tk.t === 'op' && (tk.v === '!' || tk.v === '-')) {
      p++;
      e = { k: 'un', op: tk.v, e: primario() };
      return e;
    } else {
      throw new Error(`Token inesperado "${String(tk.v)}" en: ${fuente}`);
    }
    while (esOp('->')) {
      p++;
      const n = sig();
      if (n?.t !== 'id') throw new Error(`Propiedad inválida en: ${fuente}`);
      p++;
      e = esOp('(')
        ? { k: 'metodo', o: e, n: n.v, a: argumentos() }
        : { k: 'prop', o: e, n: n.v };
    }
    return e;
  };

  const binaria = (minimo: number): Expr => {
    let izq = primario();
    for (;;) {
      const tk = sig();
      const prec = tk?.t === 'op' ? PRECEDENCIA[tk.v] : undefined;
      if (prec === undefined || prec < minimo) return izq;
      p++;
      const der = binaria(prec + 1);
      izq = { k: 'bin', op: (tk as { v: string }).v, l: izq, r: der };
    }
  };

  const expresion = (): Expr => {
    // Asignación: $var = expr
    if (
      sig()?.t === 'var' &&
      toks[p + 1]?.t === 'op' &&
      toks[p + 1].v === '='
    ) {
      const n = (sig() as { v: string }).v;
      p += 2;
      return { k: 'asig', n, e: expresion() };
    }
    const c = binaria(1);
    if (esOp('?')) {
      p++;
      let a: Expr | null = null;
      if (!esOp(':')) a = expresion();
      consumir(':');
      return { k: 'ter', c, a, b: expresion() };
    }
    return c;
  };

  const resultado = expresion();
  if (p < toks.length) throw new Error(`Sobran tokens en: ${fuente}`);
  return resultado;
}

// ---------------------------------------------------------------- semántica PHP

const NUMERICO = /^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?\s*$/;
const esNumerico = (s: string) => NUMERICO.test(s);

export function verdadero(v: unknown): boolean {
  if (v === null || v === undefined || v === false) return false;
  if (v === 0 || v === '' || v === '0') return false;
  // Un arreglo vacío es falso; una colección Eloquent (objeto) no.
  if (Array.isArray(v) && !(v instanceof Coleccion)) return v.length > 0;
  return true;
}

export function textoPhp(v: unknown): string {
  if (v === null || v === undefined || v === false) return '';
  if (v === true) return '1';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'bigint') return String(v);
  return '';
}

export function escaparHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** `<=>` de PHP 8 para escalares: negativo, 0 o positivo. */
export function compararPhp(a: unknown, b: unknown): number {
  const vacio = (x: unknown) => x === null || x === undefined;
  // bool o null contra cualquier cosa (salvo null contra cadena): se comparan como bool.
  const nulaContraTexto =
    (vacio(a) && typeof b === 'string') || (vacio(b) && typeof a === 'string');
  if (
    typeof a === 'boolean' ||
    typeof b === 'boolean' ||
    ((vacio(a) || vacio(b)) && !nulaContraTexto)
  ) {
    return Number(verdadero(a)) - Number(verdadero(b));
  }
  if (vacio(a)) a = '';
  if (vacio(b)) b = '';
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'number' && typeof b === 'string') {
    return esNumerico(b) ? a - Number(b) : cmpTexto(String(a), b);
  }
  if (typeof a === 'string' && typeof b === 'number') {
    return esNumerico(a) ? Number(a) - b : cmpTexto(a, String(b));
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return esNumerico(a) && esNumerico(b)
      ? Number(a) - Number(b)
      : cmpTexto(a, b);
  }
  return a === b ? 0 : 1;
}

const cmpTexto = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function igualPhp(a: unknown, b: unknown): boolean {
  return compararPhp(a, b) === 0;
}

function numberFormat(valor: unknown, dec = 0, dp = '.', ts = ','): string {
  let n = typeof valor === 'number' ? valor : Number(textoPhp(valor));
  if (!Number.isFinite(n)) n = 0;
  const factor = 10 ** dec;
  // Redondeo "half away from zero" como PHP (con corrección de coma flotante).
  const r =
    (Math.sign(n) * Math.round(Math.abs(n) * factor * (1 + Number.EPSILON))) /
    factor;
  const [entero, decimales = ''] = Math.abs(r).toFixed(dec).split('.');
  const miles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ts);
  const signo = r < 0 && Number(r.toFixed(dec)) !== 0 ? '-' : '';
  return signo + miles + (dec > 0 ? dp + decimales : '');
}

function strPad(
  valor: unknown,
  largo: number,
  relleno = ' ',
  tipo = 1,
): string {
  const s = textoPhp(valor);
  const falta = largo - s.length;
  if (falta <= 0 || relleno === '') return s;
  const hacer = (n: number) =>
    relleno.repeat(Math.ceil(n / relleno.length)).slice(0, n);
  if (tipo === 0) return hacer(falta) + s;
  if (tipo === 2) {
    const izq = Math.floor(falta / 2);
    return hacer(izq) + s + hacer(falta - izq);
  }
  return s + hacer(falta);
}

/** Subconjunto de Carbon: solo `format` con letras de fecha/hora. */
export class Fecha {
  constructor(
    readonly y: string,
    readonly m: string,
    readonly d: string,
    readonly h = '00',
    readonly i = '00',
    readonly s = '00',
  ) {}

  static desde(valor: unknown): Fecha | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/.exec(
      textoPhp(valor),
    );
    return m ? new Fecha(m[1], m[2], m[3], m[4], m[5], m[6]) : null;
  }

  formato(f: string): string {
    return [...f]
      .map((c) => {
        switch (c) {
          case 'd':
            return this.d;
          case 'm':
            return this.m;
          case 'Y':
            return this.y;
          case 'y':
            return this.y.slice(2);
          case 'H':
            return this.h;
          case 'i':
            return this.i;
          case 's':
            return this.s;
          default:
            return c;
        }
      })
      .join('');
  }
}

const CONSTANTES: Record<string, unknown> = {
  STR_PAD_LEFT: 0,
  STR_PAD_RIGHT: 1,
  STR_PAD_BOTH: 2,
  true: true,
  false: false,
  null: null,
  TRUE: true,
  FALSE: false,
  NULL: null,
};

export function evaluar(e: Expr, ctx: Contexto): unknown {
  switch (e.k) {
    case 'num':
    case 'str':
      return e.v;
    case 'var':
      return ctx.vars[e.n] ?? null;
    case 'const':
      if (e.n in CONSTANTES) return CONSTANTES[e.n];
      throw new Error(`Constante no soportada: ${e.n}`);
    case 'prop':
      return propiedad(evaluar(e.o, ctx), e.n);
    case 'un': {
      const v = evaluar(e.e, ctx);
      return e.op === '!' ? !verdadero(v) : -Number(textoPhp(v));
    }
    case 'bin': {
      if (e.op === '&&')
        return verdadero(evaluar(e.l, ctx)) && verdadero(evaluar(e.r, ctx));
      if (e.op === '||')
        return verdadero(evaluar(e.l, ctx)) || verdadero(evaluar(e.r, ctx));
      const l = evaluar(e.l, ctx);
      const r = evaluar(e.r, ctx);
      switch (e.op) {
        case '==':
          return igualPhp(l, r);
        case '!=':
          return !igualPhp(l, r);
        case '===':
          return l === r || (l == null && r == null);
        case '!==':
          return !(l === r || (l == null && r == null));
        case '<':
          return compararPhp(l, r) < 0;
        case '<=':
          return compararPhp(l, r) <= 0;
        case '>':
          return compararPhp(l, r) > 0;
        case '>=':
          return compararPhp(l, r) >= 0;
        case '.':
          return textoPhp(l) + textoPhp(r);
        case '+':
          return Number(textoPhp(l)) + Number(textoPhp(r));
        case '-':
          return Number(textoPhp(l)) - Number(textoPhp(r));
        case '*':
          return Number(textoPhp(l)) * Number(textoPhp(r));
        case '/':
          return Number(textoPhp(l)) / Number(textoPhp(r));
        case '%':
          return Number(textoPhp(l)) % Number(textoPhp(r));
      }
      throw new Error(`Operador no soportado: ${e.op}`);
    }
    case 'ter': {
      const c = evaluar(e.c, ctx);
      if (e.a === null) return verdadero(c) ? c : evaluar(e.b, ctx);
      return verdadero(c) ? evaluar(e.a, ctx) : evaluar(e.b, ctx);
    }
    case 'asig': {
      const v = evaluar(e.e, ctx);
      ctx.vars[e.n] = v;
      return v;
    }
    case 'estatica': {
      const args = e.a.map((a) => evaluar(a, ctx));
      if (
        /^Carbon(\\Carbon)?$/.test(e.c.replace(/^.*\\(?=Carbon$)/, '')) &&
        e.m === 'create'
      ) {
        return Fecha.desde(args[0]);
      }
      throw new Error(`Llamada estática no soportada: ${e.c}::${e.m}`);
    }
    case 'metodo': {
      const obj = evaluar(e.o, ctx);
      const args = e.a.map((a) => evaluar(a, ctx));
      if (obj instanceof Fecha && e.n === 'format')
        return obj.formato(textoPhp(args[0]));
      if (obj === null) return null;
      throw new Error(`Método no soportado: ${e.n}`);
    }
    case 'llamada':
      return llamar(e, ctx);
  }
}

function llamar(e: Extract<Expr, { k: 'llamada' }>, ctx: Contexto): unknown {
  // empty()/isset() no fallan con valores inexistentes: aquí todo es null seguro.
  const args = e.a.map((a) => evaluar(a, ctx));
  switch (e.n) {
    case 'mb_strtoupper':
      return textoPhp(args[0]).toUpperCase();
    case 'str_pad':
      return strPad(
        args[0],
        Number(args[1]),
        args[2] as string | undefined,
        args[3] as number | undefined,
      );
    case 'number_format':
      return numberFormat(
        args[0],
        args[1] === undefined ? 0 : Number(args[1]),
        args[2] as string | undefined,
        args[3] as string | undefined,
      );
    case 'count':
      return Array.isArray(args[0]) ? args[0].length : 0;
    case 'session':
      return ctx.sesion[textoPhp(args[0])] ?? null;
    case 'empty':
      return !verdadero(args[0]);
    case 'isset':
      return args.every((a) => a !== null && a !== undefined);
    case 'is_null':
      return args[0] === null || args[0] === undefined;
  }
  throw new Error(`Función PHP no soportada: ${e.n}`);
}

/** Cadenas de propiedades `$var->a->b` que contiene la expresión (para precargar relaciones). */
export function cadenasDe(
  e: Expr,
  salida: { raiz: string; ruta: string[] }[] = [],
) {
  const aplanar = (x: Expr): { raiz: string; ruta: string[] } | null => {
    if (x.k === 'var') return { raiz: x.n, ruta: [] };
    if (x.k === 'prop') {
      const base = aplanar(x.o);
      return base ? { raiz: base.raiz, ruta: [...base.ruta, x.n] } : null;
    }
    return null;
  };
  const visitar = (x: Expr) => {
    const cadena = aplanar(x);
    if (cadena) {
      salida.push(cadena);
      return;
    }
    switch (x.k) {
      case 'prop':
        visitar(x.o);
        break;
      case 'un':
        visitar(x.e);
        break;
      case 'bin':
        visitar(x.l);
        visitar(x.r);
        break;
      case 'ter':
        visitar(x.c);
        if (x.a) visitar(x.a);
        visitar(x.b);
        break;
      case 'asig':
        visitar(x.e);
        break;
      case 'llamada':
      case 'estatica':
        x.a.forEach(visitar);
        break;
      case 'metodo':
        visitar(x.o);
        x.a.forEach(visitar);
        break;
    }
  };
  visitar(e);
  return salida;
}
