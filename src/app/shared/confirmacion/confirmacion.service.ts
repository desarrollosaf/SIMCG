import { Injectable, signal } from '@angular/core';

export interface OpcionesConfirmacion {
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  /** Estilo de acción destructiva (botón rojo y foco inicial en Cancelar). */
  peligro?: boolean;
}

export interface SolicitudConfirmacion extends OpcionesConfirmacion {
  responder: (valor: boolean) => void;
}

/** Reemplazo de los diálogos de sweetalert2: se muestra en `<app-confirmacion-host>`. */
@Injectable({ providedIn: 'root' })
export class ConfirmacionService {
  readonly actual = signal<SolicitudConfirmacion | null>(null);

  /** Resuelve true al confirmar y false al cancelar o cerrar el diálogo. */
  confirmar(opciones: OpcionesConfirmacion): Promise<boolean> {
    // Una confirmación nueva descarta la anterior pendiente.
    this.actual()?.responder(false);

    return new Promise<boolean>((resolver) => {
      const solicitud: SolicitudConfirmacion = {
        ...opciones,
        responder: (valor) => {
          if (this.actual() === solicitud) this.actual.set(null);
          resolver(valor);
        },
      };
      this.actual.set(solicitud);
    });
  }
}
