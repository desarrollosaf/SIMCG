import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { Icono, NombreIcono } from '../icono/icono';

export interface BotonIconoCeldaParams<T = unknown> extends ICellRendererParams<T> {
  /** Texto del botón (también su título y etiqueta accesible). */
  etiqueta: string;
  icono: NombreIcono;
  ejecutar: (fila: T) => void;
  /** Si devuelve true el botón se muestra deshabilitado (p. ej. mientras se envía). */
  deshabilitado?: (fila: T) => boolean;
}

/** Celda de ag-grid con un botón con icono y texto, para acciones directas de la fila. */
@Component({
  selector: 'app-boton-icono-celda',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icono],
  template: `
    <button
      type="button"
      class="boton"
      [title]="etiqueta()"
      [attr.aria-label]="etiqueta()"
      [disabled]="deshabilitado()"
      (click)="pulsar()"
    >
      <app-icono [nombre]="icono()" />
      <span>{{ etiqueta() }}</span>
    </button>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      height: 100%;
    }

    .boton {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      height: 30px;
      padding: 0 0.7rem;
      border: 1.5px solid var(--brand-border);
      border-radius: 9px;
      background: var(--surface);
      color: var(--brand-ink);
      font-size: 0.78rem;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
      transition:
        border-color 0.15s,
        color 0.15s,
        background 0.15s;

      app-icono {
        font-size: 15px;
        color: var(--accent-text);
      }

      &:hover:not(:disabled) {
        border-color: var(--brand-primary);
        background: var(--brand-primary-soft);
        color: var(--accent-text);
      }

      &:focus-visible {
        outline: 2px solid var(--brand-primary);
        outline-offset: 2px;
      }

      &:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
    }
  `,
})
export class BotonIconoCelda<T = unknown> implements ICellRendererAngularComp {
  protected readonly etiqueta = signal('');
  protected readonly icono = signal<NombreIcono>('documento');
  protected readonly deshabilitado = signal(false);
  private params!: BotonIconoCeldaParams<T>;

  agInit(params: BotonIconoCeldaParams<T>): void {
    this.refresh(params);
  }

  refresh(params: BotonIconoCeldaParams<T>): boolean {
    this.params = params;
    this.etiqueta.set(params.etiqueta);
    this.icono.set(params.icono);
    this.deshabilitado.set(
      params.data && params.deshabilitado ? params.deshabilitado(params.data) : false,
    );
    return true;
  }

  protected pulsar(): void {
    if (this.params.data) this.params.ejecutar(this.params.data);
  }
}
