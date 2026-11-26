import {
  ESTATUS_ENVIO_EN_TIEMPO,
  ESTATUS_ENVIO_EXTEMPORANEO,
  ESTATUS_EN_TIEMPO,
  ESTATUS_OMISO,
  calcularEstatus,
  fechaLimite,
} from '../servidores/movimientos.reglas';

// Reglas de plazos del sistema viejo (PDFController::SelectOmisos y
// SelectPreventivo), como funciones puras. Las fechas son 'YYYY-MM-DD' y se
// comparan como texto. El plazo es de 60 días desde la fecha de la declaración;
// en las modificaciones (tipo 3) es de 30 días (91 si la declaración es de 2021).

export {
  ESTATUS_ENVIO_EN_TIEMPO,
  ESTATUS_ENVIO_EXTEMPORANEO,
  ESTATUS_EN_TIEMPO,
  ESTATUS_OMISO,
  fechaLimite,
};

export interface EntradaPlazo {
  tipoMovimientoId: number;
  fechaDeclaracion: string;
  /** Fecha de envío de la declaración (null = sin enviar). */
  fechaEnvio: string | null;
  /** Hoy en America/Mexico_City, 'YYYY-MM-DD'. */
  hoy: string;
}

/**
 * Estatus del reporte de omisos: OMISO (sin envío y límite < hoy) o
 * ENVIO EXTEMPORANEO (envío > límite). Cualquier otro caso devuelve null y la
 * declaración no aparece en el reporte. Comparaciones estrictas, como el viejo:
 * el mismo día del límite todavía no es omiso.
 */
export function estatusOmisos(e: EntradaPlazo): string | null {
  const limite = fechaLimite(e.tipoMovimientoId, e.fechaDeclaracion);
  if (!e.fechaEnvio) {
    return limite < e.hoy ? ESTATUS_OMISO : null;
  }
  return e.fechaEnvio > limite ? ESTATUS_ENVIO_EXTEMPORANEO : null;
}

/**
 * Estatus del reporte de preventivos: EN TIEMPO solo si no se ha enviado y el
 * límite es posterior a hoy (estricto: el mismo día del límite el viejo no la
 * mostraba en preventivos ni en omisos). Si no, null.
 */
export function estatusPreventivo(e: EntradaPlazo): string | null {
  if (e.fechaEnvio) return null;
  const limite = fechaLimite(e.tipoMovimientoId, e.fechaDeclaracion);
  return limite > e.hoy ? ESTATUS_EN_TIEMPO : null;
}

/**
 * Estatus del reporte general: OMISO, EN TIEMPO, ENVIO EXTEMPORANEO o
 * ENVIO EN TIEMPO (sin espacio final).
 */
export function estatusGeneral(e: EntradaPlazo): string {
  return calcularEstatus(e);
}
