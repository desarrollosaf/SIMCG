import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Icono, NombreIcono } from '../icono/icono';

export interface AccionFila<T> {
  etiqueta: string;
  icono: NombreIcono;
  ejecutar: (fila: T) => void;
  /** Si devuelve false la acción no se ofrece para esa fila. */
  visible?: (fila: T) => boolean;
  /** Estilo de acción destructiva: va en rojo y al final del menú. */
  peligro?: boolean;
}

/** Acción de un menú que no depende de una fila (p. ej. «Más» de la barra). */
export type AccionGeneral = AccionFila<void>;

/**
 * Botón ⋮ con menú de acciones (CDK overlay: no lo recorta el grid ni el modal).
 * Accesible por teclado: Enter/Espacio/↓ abren, flechas navegan, Esc y clic fuera cierran.
 */
@Component({
  selector: 'app-menu-acciones',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkMenu, CdkMenuItem, CdkMenuTrigger, Icono],
  templateUrl: './menu-acciones.html',
  styleUrl: './menu-acciones.scss',
})
export class MenuAcciones<T = unknown> {
  readonly acciones = input.required<AccionFila<T>[]>();
  /** Fila sobre la que actúan las acciones (se omite en menús generales). */
  readonly fila = input<T>();
  readonly etiqueta = input('Más acciones');
  /** 'celda' = botón de icono; 'barra' = botón con texto «Más». */
  readonly variante = input<'celda' | 'barra'>('celda');

  /** Acciones ofrecidas; las peligrosas siempre al final. */
  protected readonly visibles = computed(() => {
    const fila = this.fila() as T;
    const lista = this.acciones().filter((a) => a.visible?.(fila) ?? true);
    return [...lista.filter((a) => !a.peligro), ...lista.filter((a) => a.peligro)];
  });

  protected ejecutar(accion: AccionFila<T>): void {
    accion.ejecutar(this.fila() as T);
  }
}
