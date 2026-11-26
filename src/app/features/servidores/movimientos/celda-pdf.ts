import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { Icono } from '../../../shared/icono/icono';

export type EstadoPdf = 'sin-envio' | 'sin-permiso' | 'disponible';

export interface CeldaPdfParams<T = unknown> extends ICellRendererParams<T> {
  /** Si la fila ya se envió y el rol puede ver los PDF. */
  estado: (fila: T) => EstadoPdf;
}

/** Texto de la columna PDF cuando no hay botones. */
export const TEXTO_SIN_PDF: Record<Exclude<EstadoPdf, 'disponible'>, string> = {
  'sin-envio': 'SIN ENVÍO',
  'sin-permiso': 'SIN PERMISO',
};

/**
 * PDF de la declaración y PDF de la versión privada. La generación de PDF todavía no
 * está implementada: los botones se muestran deshabilitados con «Próximamente».
 */
@Component({
  selector: 'app-celda-pdf',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icono],
  template: `
    @if (estado() === 'disponible') {
      <button
        type="button"
        class="pdf"
        disabled
        title="PDF de la declaración: Próximamente"
        aria-label="PDF de la declaración (próximamente)"
      >
        <app-icono nombre="documento" />
      </button>
      <button
        type="button"
        class="pdf"
        disabled
        title="PDF de la declaración privada: Próximamente"
        aria-label="PDF de la declaración privada (próximamente)"
      >
        <app-icono nombre="documento" />
      </button>
    } @else {
      <span class="sin-pdf">{{ texto() }}</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 0.5rem;
      height: 100%;
      min-width: 0;
    }

    .pdf {
      display: inline-flex;
      align-items: center;
      padding: 0;
      border: none;
      background: none;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--muted);
      cursor: not-allowed;
      opacity: 0.7;
    }

    .sin-pdf {
      font-size: 0.78rem;
      color: var(--muted);
    }
  `,
})
export class CeldaPdf<T = unknown> implements ICellRendererAngularComp {
  protected readonly estado = signal<EstadoPdf>('sin-envio');

  protected texto(): string {
    const estado = this.estado();
    return estado === 'disponible' ? '' : TEXTO_SIN_PDF[estado];
  }

  agInit(params: CeldaPdfParams<T>): void {
    this.refresh(params);
  }

  refresh(params: CeldaPdfParams<T>): boolean {
    this.estado.set(params.data ? params.estado(params.data) : 'sin-envio');
    return true;
  }
}
