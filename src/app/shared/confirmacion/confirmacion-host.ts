import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Modal } from '../modal/modal';
import { ConfirmacionService } from './confirmacion.service';

/** Se monta una sola vez (app.html) y muestra la confirmación pendiente del servicio. */
@Component({
  selector: 'app-confirmacion-host',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal],
  template: `
    @if (servicio.actual(); as solicitud) {
      <app-modal tamano="sm" [titulo]="solicitud.titulo" (cerrar)="solicitud.responder(false)">
        <p class="mensaje">{{ solicitud.mensaje }}</p>
        <div modal-pie>
          <button
            type="button"
            class="btn btn--outline"
            [attr.cdk-focus-initial]="solicitud.peligro ? '' : null"
            (click)="solicitud.responder(false)"
          >
            {{ solicitud.textoCancelar ?? 'Cancelar' }}
          </button>
          <button
            type="button"
            class="btn"
            [class.btn--peligro]="solicitud.peligro"
            [class.btn--primary]="!solicitud.peligro"
            [attr.cdk-focus-initial]="solicitud.peligro ? null : ''"
            (click)="solicitud.responder(true)"
          >
            {{ solicitud.textoConfirmar ?? 'Aceptar' }}
          </button>
        </div>
      </app-modal>
    }
  `,
  styles: `
    .mensaje {
      margin: 0;
      font-size: 0.92rem;
      line-height: 1.5;
      color: var(--brand-muted);
    }
  `,
})
export class ConfirmacionHost {
  protected readonly servicio = inject(ConfirmacionService);
}
