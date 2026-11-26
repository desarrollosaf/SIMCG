import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { Icono } from '../icono/icono';

const POSICIONES: ConnectedPosition[] = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
];

/**
 * Botón «Filtros» (con insignia del número de filtros activos) que abre un panel
 * compacto con los controles proyectados (`<ng-content />`). Reutilizable por cualquier lista.
 * Esc y clic fuera cierran el panel.
 */
@Component({
  selector: 'app-filtros-popover',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, Icono],
  template: `
    <button
      type="button"
      class="btn btn--outline boton-filtros"
      cdkOverlayOrigin
      #origen="cdkOverlayOrigin"
      aria-haspopup="dialog"
      [attr.aria-expanded]="abierto()"
      (click)="abierto.set(!abierto())"
    >
      <app-icono nombre="filtro" />
      <span>{{ etiqueta() }}</span>
      @if (activos() > 0) {
        <span class="insignia" [attr.aria-label]="activos() + ' filtros activos'">{{
          activos()
        }}</span>
      }
    </button>

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origen"
      [cdkConnectedOverlayOpen]="abierto()"
      [cdkConnectedOverlayPositions]="posiciones"
      (overlayOutsideClick)="alClicFuera($event)"
      (overlayKeydown)="alTecla($event)"
      (detach)="abierto.set(false)"
    >
      <div class="panel" role="dialog" [attr.aria-label]="etiqueta()">
        <div class="panel__cuerpo">
          <ng-content />
        </div>
        @if (activos() > 0) {
          <div class="panel__pie">
            <button type="button" class="enlace-limpiar" (click)="limpiar.emit()">
              Limpiar filtros
            </button>
          </div>
        }
      </div>
    </ng-template>
  `,
  styleUrl: './filtros-popover.scss',
})
export class FiltrosPopover {
  readonly activos = input(0);
  readonly etiqueta = input('Filtros');
  readonly limpiar = output<void>();

  protected readonly abierto = signal(false);
  protected readonly posiciones = POSICIONES;

  protected alClicFuera(evento: MouseEvent): void {
    // El clic en el propio botón lo maneja su (click): evita cerrar y reabrir.
    const destino = evento.target as HTMLElement | null;
    if (destino?.closest?.('.boton-filtros')) return;
    this.abierto.set(false);
  }

  protected alTecla(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') this.abierto.set(false);
  }
}
