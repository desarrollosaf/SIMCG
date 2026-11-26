import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { Observable } from 'rxjs';
import { ToastService } from '../../../core/services/toast.service';
import { Icono } from '../../../shared/icono/icono';
import { abrirPdf } from '../../../shared/utils/descarga';

export type EstadoPdf = 'sin-envio' | 'sin-permiso' | 'disponible';

export interface CeldaPdfParams<T = unknown> extends ICellRendererParams<T> {
  /** Si la fila ya se envió y el rol puede ver los PDF. */
  estado: (fila: T) => EstadoPdf;
  /** Descarga el PDF de la declaración (pública o privada) de la fila. */
  pdf: (fila: T, privada: boolean) => Observable<Blob>;
}

/** Texto de la columna PDF cuando no hay botones. */
export const TEXTO_SIN_PDF: Record<Exclude<EstadoPdf, 'disponible'>, string> = {
  'sin-envio': 'SIN ENVÍO',
  'sin-permiso': 'SIN PERMISO',
};

/** PDF de la declaración pública y PDF de la declaración privada, en una pestaña nueva. */
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
        title="PDF de la declaración"
        aria-label="PDF de la declaración"
        [disabled]="generando() !== null"
        (click)="abrir(false)"
      >
        <app-icono nombre="documento" />
      </button>
      <button
        type="button"
        class="pdf"
        title="PDF de la declaración privada"
        aria-label="PDF de la declaración privada"
        [disabled]="generando() !== null"
        (click)="abrir(true)"
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
      color: var(--accent-text);
      cursor: pointer;
    }

    .pdf:disabled {
      color: var(--muted);
      cursor: progress;
      opacity: 0.7;
    }

    .sin-pdf {
      font-size: 0.78rem;
      color: var(--muted);
    }
  `,
})
export class CeldaPdf<T = unknown> implements ICellRendererAngularComp {
  private readonly toast = inject(ToastService);
  private params: CeldaPdfParams<T> | null = null;

  protected readonly estado = signal<EstadoPdf>('sin-envio');
  /** Mientras se genera un PDF (tarda unos segundos) los botones se bloquean. */
  protected readonly generando = signal<'publica' | 'privada' | null>(null);

  protected texto(): string {
    const estado = this.estado();
    return estado === 'disponible' ? '' : TEXTO_SIN_PDF[estado];
  }

  protected abrir(privada: boolean): void {
    const params = this.params;
    if (!params?.data || this.generando()) return;
    this.generando.set(privada ? 'privada' : 'publica');
    params.pdf(params.data, privada).subscribe({
      next: (blob) => {
        this.generando.set(null);
        abrirPdf(blob);
      },
      error: (err: unknown) => {
        this.generando.set(null);
        this.toast.errorHttp(err, 'No se pudo generar el PDF de la declaración.');
      },
    });
  }

  agInit(params: CeldaPdfParams<T>): void {
    this.refresh(params);
  }

  refresh(params: CeldaPdfParams<T>): boolean {
    this.params = params;
    this.estado.set(params.data ? params.estado(params.data) : 'sin-envio');
    return true;
  }
}
