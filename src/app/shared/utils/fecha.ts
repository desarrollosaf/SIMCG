const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** «2026-03-12» (o con hora) → «12 mar 2026». Devuelve '' si no es una fecha válida. */
export function formatearFecha(fecha: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha ?? '');
  if (!m) return '';
  const mes = MESES[Number(m[2]) - 1];
  if (!mes) return '';
  return `${Number(m[3])} ${mes} ${m[1]}`;
}
