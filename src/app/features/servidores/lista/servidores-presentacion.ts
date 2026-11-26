import { ServidorFila } from '../../../core/services/servidores.service';
import { EstadoVisual } from '../../../shared/ag-grid/estado-celda';
import { formatearFecha } from '../../../shared/utils/fecha';

/** Chip de estatus del servidor: Obligado (verde), No obligado (gris) o Baja (rojo). */
export function estatusServidor(fila: ServidorFila): EstadoVisual {
  switch (fila.estatus) {
    case 'baja':
      return { texto: 'Baja', tono: 'error' };
    case 'obligado':
      return { texto: 'Obligado', tono: 'ok' };
    case 'no_obligado':
      return { texto: 'No obligado', tono: 'neutro' };
    default:
      return { texto: 'Sin movimientos', tono: 'neutro' };
  }
}

export const tipoUltimoMovimiento = (fila: ServidorFila): string =>
  fila.ultimoMovimiento ? (fila.ultimoMovimiento.tipo ?? 'Movimiento') : 'Sin movimientos';

export const fechaUltimoMovimiento = (fila: ServidorFila): string =>
  formatearFecha(fila.ultimoMovimiento?.fecha);

/** Dependencia y dirección en una sola línea (para las tarjetas móviles). */
export const adscripcion = (fila: ServidorFila): string =>
  [fila.dependencia, fila.direccion].filter(Boolean).join(' · ');
