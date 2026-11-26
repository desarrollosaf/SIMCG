import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { AccionFila, MenuAcciones } from './menu-acciones';

export type { AccionFila } from './menu-acciones';

export interface AccionesCeldaParams<T> extends ICellRendererParams<T> {
  acciones: AccionFila<T>[];
}

/** Columna «Acciones» fija a la derecha, con encabezado centrado, sin orden ni redimensión. */
export function columnaAcciones<T>(acciones: AccionFila<T>[]): ColDef<T> {
  return {
    colId: 'acciones',
    headerName: 'Acciones',
    width: 96,
    pinned: 'right',
    sortable: false,
    filter: false,
    resizable: false,
    suppressMovable: true,
    headerClass: 'ag-center-aligned-header',
    cellRenderer: AccionesCelda,
    cellRendererParams: { acciones },
  };
}

/** Celda de ag-grid con un único botón ⋮ que abre el menú de acciones de la fila. */
@Component({
  selector: 'app-acciones-celda',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MenuAcciones],
  template: `<app-menu-acciones [acciones]="acciones()" [fila]="fila()" />`,
  styles: `
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
    }
  `,
})
export class AccionesCelda<T = unknown> implements ICellRendererAngularComp {
  protected readonly acciones = signal<AccionFila<T>[]>([]);
  protected readonly fila = signal<T | undefined>(undefined);

  agInit(params: AccionesCeldaParams<T>): void {
    this.refresh(params);
  }

  refresh(params: AccionesCeldaParams<T>): boolean {
    this.acciones.set(params.acciones);
    this.fila.set(params.data);
    return true;
  }
}
