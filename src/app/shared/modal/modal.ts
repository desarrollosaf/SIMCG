import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Icono } from '../icono/icono';
import { PilaModales } from './pila-modales';

export type TamanoModal = 'sm' | 'md' | 'lg' | 'xl';

let siguienteId = 0;

/**
 * Diálogo modal accesible. El padre lo monta con `@if`; al desmontarse corre la animación de salida.
 * Proyecta el cuerpo (por defecto), `[modal-acciones]` en el encabezado y `[modal-pie]` en el pie.
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkTrapFocus, Icono],
  templateUrl: './modal.html',
  styleUrl: './modal.scss',
  host: {
    '(document:keydown.escape)': 'alEscape($event)',
    '[style.z-index]': 'zIndex()',
    // La animación de salida va en el host: la corre Angular al desmontarlo con @if.
    'animate.leave': 'modal-salida',
  },
})
export class Modal implements OnInit, OnDestroy {
  private readonly pila = inject(PilaModales);
  private readonly token = Symbol('modal');

  readonly titulo = input.required<string>();
  readonly subtitulo = input<string>();
  readonly tamano = input<TamanoModal>('md');
  /** Mientras es true (p. ej. guardando) no se puede cerrar por Esc, fondo ni botón. */
  readonly bloqueado = input(false);

  readonly cerrar = output<void>();

  protected readonly idTitulo = `modal-titulo-${++siguienteId}`;
  protected readonly zIndex = signal(0);

  ngOnInit(): void {
    this.zIndex.set(this.pila.abrir(this.token));
  }

  ngOnDestroy(): void {
    this.pila.cerrar(this.token);
  }

  solicitarCierre(): void {
    if (this.bloqueado()) return;
    this.cerrar.emit();
  }

  protected alEscape(evento: Event): void {
    if (!this.pila.esSuperior(this.token) || evento.defaultPrevented) return;
    evento.preventDefault();
    this.solicitarCierre();
  }
}
