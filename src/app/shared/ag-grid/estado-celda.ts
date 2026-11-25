import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

export type TonoEstado = 'ok' | 'error' | 'info' | 'neutro';

export interface EstadoVisual {
  texto: string;
  tono: TonoEstado;
}

export interface EstadoCeldaParams extends ICellRendererParams {
  /** Devuelve el texto y el tono de la insignia para la fila. */
  estado: (data: unknown) => EstadoVisual;
}

@Component({
  selector: 'app-estado-celda',
  standalone: true,
  template: `<span class="insignia" [attr.data-tono]="visual.tono">{{ visual.texto }}</span>`,
  styles: `
    .insignia {
      display: inline-block;
      padding: 0.15rem 0.65rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 700;
      line-height: 1.4;
      background: var(--surface-2);
      color: var(--brand-muted);
    }

    .insignia[data-tono='ok'] {
      background: var(--success-bg);
      color: var(--success-ink);
    }

    .insignia[data-tono='error'] {
      background: var(--danger-soft);
      color: var(--brand-danger);
    }

    .insignia[data-tono='info'] {
      background: var(--info-bg);
      color: var(--info-ink);
    }
  `,
})
export class EstadoCelda implements ICellRendererAngularComp {
  protected visual: EstadoVisual = { texto: '', tono: 'neutro' };

  agInit(params: EstadoCeldaParams): void {
    this.visual = params.estado(params.data);
  }

  refresh(params: EstadoCeldaParams): boolean {
    this.visual = params.estado(params.data);
    return true;
  }
}
