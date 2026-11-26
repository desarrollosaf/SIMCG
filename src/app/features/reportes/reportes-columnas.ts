import { ColDef, SortChangedEvent } from 'ag-grid-community';
import { FilaReporte } from '../../core/services/reportes.service';
import { CeldaDosNiveles } from '../../shared/ag-grid/celda-dos-niveles';
import { CeldaEstatus } from '../../shared/ag-grid/celda-estatus';
import {
  ClaveOrden,
  Orden,
  adscripcionSecundaria,
  envioFila,
  estatusVisual,
  nombreFila,
  textoFila,
} from './reportes-presentacion';

// El orden lo hace el componente sobre todas las filas; el grid no debe reordenar la página.
const SIN_ORDEN_LOCAL = () => 0;

const ordenable = (col: ColDef<FilaReporte>): ColDef<FilaReporte> => ({
  ...col,
  sortable: true,
  comparator: SIN_ORDEN_LOCAL,
});

/**
 * Las ocho primeras columnas de los reportes de omisos y preventivos (NOMBRE … ESTADO DEL SP).
 * Preventivos muestra los textos en mayúsculas; omisos tal como están guardados.
 */
export function columnasReporte(mayusculas: boolean): ColDef<FilaReporte>[] {
  return [
    ordenable({
      colId: 'nombre',
      headerName: 'NOMBRE',
      minWidth: 170,
      flex: 1.6,
      valueGetter: (p) => (p.data ? nombreFila(p.data, mayusculas) : ''),
    }),
    ordenable({
      colId: 'curp',
      headerName: 'CURP',
      minWidth: 170,
      flex: 1.2,
      valueGetter: (p) => textoFila(p.data?.curp, mayusculas),
    }),
    ordenable({
      colId: 'cargo',
      headerName: 'CARGO',
      minWidth: 150,
      flex: 1.3,
      valueGetter: (p) => textoFila(p.data?.cargo, mayusculas),
    }),
    ordenable({
      colId: 'dependencia',
      headerName: 'DEPENDENCIA',
      minWidth: 200,
      flex: 1.8,
      cellRenderer: CeldaDosNiveles,
      cellRendererParams: {
        principal: (f: FilaReporte) => textoFila(f.dependencia, mayusculas),
        secundario: (f: FilaReporte) => adscripcionSecundaria(f, mayusculas),
      },
    }),
    ordenable({
      colId: 'tipoMovimiento',
      headerName: 'T. DE MOVIMIENTO',
      minWidth: 140,
      flex: 1,
      valueGetter: (p) => p.data?.tipoMovimiento ?? '',
    }),
    ordenable({
      colId: 'fechaDeclaracion',
      headerName: 'F. DE MOVIMIENTO',
      minWidth: 130,
      flex: 0.9,
      valueGetter: (p) => (p.data?.fechaDeclaracion ?? ''),
    }),
    ordenable({
      colId: 'envio',
      headerName: 'ENVÍO',
      minWidth: 160,
      flex: 1.1,
      valueGetter: (p) => (p.data ? envioFila(p.data) : ''),
    }),
    ordenable({
      colId: 'estatus',
      headerName: 'ESTADO DEL SP',
      minWidth: 170,
      flex: 1.1,
      cellRenderer: CeldaEstatus,
      cellRendererParams: { estatus: estatusVisual },
    }),
  ];
}

/** Orden elegido en el encabezado del grid (null = sin orden). */
export function ordenDeGrid(evento: SortChangedEvent<FilaReporte>): Orden | null {
  const columna = evento.api.getColumnState().find((c) => c.sort);
  return columna?.sort ? { clave: columna.colId as ClaveOrden, direccion: columna.sort } : null;
}
