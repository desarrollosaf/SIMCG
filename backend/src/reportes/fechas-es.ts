const DIAS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * Fecha larga en español con el formato 'l j F Y' del sistema viejo
 * (Jenssegers Date, es): día de la semana y mes en minúsculas, día sin cero.
 * Ej.: '2026-11-26' -> 'jueves 26 noviembre 2026'.
 */
export function fechaLarga(fecha: string): string {
  const [anio, mes, dia] = fecha.slice(0, 10).split('-').map(Number);
  const f = new Date(Date.UTC(anio, mes - 1, dia));
  return `${DIAS[f.getUTCDay()]} ${dia} ${MESES[mes - 1]} ${anio}`;
}
