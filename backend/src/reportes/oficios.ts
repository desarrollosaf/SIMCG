import {
  TIPO_MOV_CONCLUSION,
  TIPO_MOV_INGRESO,
  TIPO_MOV_MODIFICACION,
  TIPO_MOV_REINGRESO,
} from '../database/models/tipo-movimiento-mcg.model';

// Funciones puras con las reglas de texto de los oficios del sistema viejo
// (resources/views/Oficios/remision.blade.php y preventivo.blade.php).

export const PREFIJO_OFICIO = 'CPL/DSP/MCG/';

// Ids de tipo_direccion con nombre especial en el oficio de remisión.
export const DIRECCION_MORENA = 56;
export const DIRECCION_MOVIMIENTO_CIUDADANO = 55;

/** Quita espacios y el prefijo CPL/DSP/MCG/ para no duplicarlo en el número. */
export function normalizarFolio(folio: string): string {
  const limpio = folio.trim();
  return limpio.toUpperCase().startsWith(PREFIJO_OFICIO)
    ? limpio.slice(PREFIJO_OFICIO.length).trim()
    : limpio;
}

/** Número de oficio: CPL/DSP/MCG/{folio}/{año}. */
export function numeroOficio(folio: string, anio: string): string {
  return `${PREFIJO_OFICIO}${normalizarFolio(folio)}/${anio}`;
}

/** Fracción del artículo 34 en el párrafo de «En ese tenor»; otros tipos: vacía. */
export function fraccionArticulo34(tipoMovimientoId: number): string {
  switch (tipoMovimientoId) {
    case TIPO_MOV_INGRESO:
      return 'I, inciso a,';
    case TIPO_MOV_REINGRESO:
      return 'I, inciso b,';
    case TIPO_MOV_MODIFICACION:
      return 'II,';
    case TIPO_MOV_CONCLUSION:
      return 'III,';
    default:
      return '';
  }
}

/** Fracción del párrafo final: igual, pero cualquier otro tipo cae a «III,». */
export function fraccionArticulo34Final(tipoMovimientoId: number): string {
  return fraccionArticulo34(tipoMovimientoId) || 'III,';
}

/** ucfirst(mb_strtolower(valor)) de PHP: ucfirst solo cambia una a-z inicial. */
export function primeraMayuscula(valor: string): string {
  const minusculas = valor.toLowerCase();
  return /^[a-z]/.test(minusculas)
    ? minusculas.charAt(0).toUpperCase() + minusculas.slice(1)
    : minusculas;
}

/** Dirección tal como se imprime en el oficio de remisión. */
export function direccionRemision(
  direccionId: number | null | undefined,
  nombre: string | null | undefined,
): string {
  if (direccionId === DIRECCION_MORENA) return 'GRUPO PARLAMENTARIO morena';
  if (direccionId === DIRECCION_MOVIMIENTO_CIUDADANO) {
    return 'GRUPO PARLAMENTARIO MOVIMIENTO CIUDADANO';
  }
  return (nombre ?? '').toUpperCase();
}

/**
 * Iniciales del usuario que elabora el oficio: la inicial de cada palabra del
 * nombre (o la del nombre si es una sola) más la inicial de cada apellido.
 */
export function inicialesDe(
  nombre: string,
  primerApellido: string | null | undefined,
  segundoApellido: string | null | undefined,
): string {
  const palabras = nombre.split(' ').filter(Boolean);
  const delNombre = palabras.map((p) => p.charAt(0)).join('');
  return `${delNombre}${(primerApellido ?? '').charAt(0)}${(segundoApellido ?? '').charAt(0)}`;
}

/** Nombre completo en mayúsculas, sin espacios sobrantes si falta un apellido. */
export function nombreMayusculas(
  nombre: string,
  primerApellido: string | null | undefined,
  segundoApellido: string | null | undefined,
): string {
  return [nombre, primerApellido, segundoApellido]
    .filter((p): p is string => !!p && p.trim() !== '')
    .map((p) => p.trim().toUpperCase())
    .join(' ');
}

/** Texto del plazo dentro del párrafo del oficio preventivo (tipo != 3 o modificación). */
export function plazoPreventivo(
  tipoMovimientoId: number,
  tipoMinusculas: string,
): string {
  if (tipoMovimientoId !== TIPO_MOV_MODIFICACION) {
    return (
      'como es de su conocimiento, conforme a la ley de la materia, para la presentación de estas ' +
      'Declaraciones, cuenta con 60 días naturales contados a partir del día siguiente en que la ' +
      'Dirección de Administración y Desarrollo de Personal registre su movimiento por declaración de ' +
      `${tipoMinusculas},`
    );
  }
  return (
    'como es de su conocimiento, conforme a la ley de la materia, para la presentación de estas ' +
    'Declaraciones, cuenta con el plazo del 1 al 31 de mayo del año que transcurre para realizarlo.'
  );
}
