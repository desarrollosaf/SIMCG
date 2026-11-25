import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

export type IconoBoton = 'basura' | 'pagar' | 'editar' | 'lista';

export interface ButtonCellRendererParams extends ICellRendererParams {
  label: string;
  onClick: (data: unknown) => void;
  visible?: (data: unknown) => boolean;
  icono?: IconoBoton;
}

@Component({
  selector: 'app-boton-celda',
  standalone: true,
  template: `
    @if (visible) {
      <button
        type="button"
        class="quitar"
        [class.quitar--pagar]="icono === 'pagar'"
        [class.quitar--neutro]="icono === 'editar' || icono === 'lista'"
        (click)="onClick()"
      >
        <span class="quitar__icono">
          @if (icono === 'pagar') {
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
              <path
                d="M8.5 12.3l2.3 2.3 4.7-4.7"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          } @else if (icono === 'editar') {
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Zm9-13 4 4"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          } @else if (icono === 'lista') {
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"
                stroke="currentColor"
                stroke-width="2.4"
                stroke-linecap="round"
              />
            </svg>
          } @else {
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-1 12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7h12Z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linejoin="round"
              />
            </svg>
          }
        </span>
        <span class="quitar__texto">{{ label }}</span>
      </button>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
      }

      .quitar {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.15rem 0.65rem 0.15rem 0.15rem;
        border: none;
        border-radius: 999px;
        background: transparent;
        color: var(--brand-danger);
        font-size: 0.74rem;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.18s ease;
      }

      .quitar__icono {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: var(--danger-soft);
        color: var(--brand-danger);
        flex-shrink: 0;
        transition:
          background 0.18s ease,
          color 0.18s ease,
          transform 0.18s ease;
      }

      .quitar__icono svg {
        width: 11px;
        height: 11px;
      }

      .quitar:hover {
        background: var(--danger-hover);
      }

      .quitar:hover .quitar__icono {
        background: var(--brand-danger);
        color: #fff;
        transform: scale(1.1) rotate(-6deg);
      }

      .quitar:active .quitar__icono {
        transform: scale(0.96);
      }

      .quitar--pagar {
        color: var(--success-strong);
      }

      .quitar--pagar .quitar__icono {
        background: var(--success-soft);
        color: var(--success-strong);
      }

      .quitar--pagar:hover {
        background: var(--success-hover);
      }

      .quitar--pagar:hover .quitar__icono {
        background: var(--success-strong);
        color: #fff;
        transform: scale(1.1) rotate(0deg);
      }

      .quitar--neutro {
        color: var(--accent-text);
      }

      .quitar--neutro .quitar__icono {
        background: var(--brand-primary-soft);
        color: var(--accent-text);
      }

      .quitar--neutro:hover {
        background: var(--brand-primary-soft);
      }

      .quitar--neutro:hover .quitar__icono {
        background: var(--brand-primary);
        color: #fff;
        transform: scale(1.1) rotate(0deg);
      }
    `,
  ],
})
export class BotonCeldaComponent implements ICellRendererAngularComp {
  protected label = '';
  protected visible = true;
  protected icono: IconoBoton = 'basura';
  private params!: ButtonCellRendererParams;

  agInit(params: ButtonCellRendererParams): void {
    this.params = params;
    this.label = params.label;
    this.icono = params.icono ?? 'basura';
    this.visible = params.visible ? params.visible(params.data) : true;
  }

  refresh(params: ButtonCellRendererParams): boolean {
    this.agInit(params);
    return true;
  }

  onClick(): void {
    this.params.onClick(this.params.data);
  }
}
