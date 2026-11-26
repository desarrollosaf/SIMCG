import { CdkTrapFocus } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { Icono } from '../icono/icono';

let siguienteId = 0;

/**
 * Botón «Ayuda» que abre un panel lateral derecho con las instrucciones proyectadas.
 * Se cierra con la X, Esc o al hacer clic fuera del panel.
 */
@Component({
  selector: 'app-ayuda',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkTrapFocus, Icono],
  templateUrl: './ayuda.html',
  styleUrl: './ayuda.scss',
  host: { '(document:keydown.escape)': 'cerrar()' },
})
export class Ayuda {
  readonly titulo = input('Ayuda');

  protected readonly abierto = signal(false);
  protected readonly idTitulo = `ayuda-titulo-${++siguienteId}`;

  abrir(): void {
    this.abierto.set(true);
  }

  cerrar(): void {
    this.abierto.set(false);
  }
}
