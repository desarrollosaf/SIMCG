import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { ChipEstatus } from './chip-estatus';
import { EstadoVisual } from './estado-celda';

export interface CeldaEstatusParams<T = unknown> extends ICellRendererParams<T> {
  /** Texto y tono del chip para la fila (null = sin chip). */
  estatus: (fila: T) => EstadoVisual | null;
}

/** Celda de ag-grid con un chip de estatus. */
@Component({
  selector: 'app-celda-estatus',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChipEstatus],
  template: `
    @if (visual(); as v) {
      <app-chip-estatus [texto]="v.texto" [tono]="v.tono" />
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      height: 100%;
    }
  `,
})
export class CeldaEstatus<T = unknown> implements ICellRendererAngularComp {
  protected readonly visual = signal<EstadoVisual | null>(null);

  agInit(params: CeldaEstatusParams<T>): void {
    this.refresh(params);
  }

  refresh(params: CeldaEstatusParams<T>): boolean {
    this.visual.set(params.data ? params.estatus(params.data) : null);
    return true;
  }
}
