import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icono, NombreIcono } from '../icono/icono';

/** Estado vacío: lista sin datos o búsqueda sin resultados. La acción se proyecta como contenido. */
@Component({
  selector: 'app-estado-vacio',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icono],
  template: `
    <div class="estado">
      <span class="estado__icono" aria-hidden="true"><app-icono [nombre]="icono()" /></span>
      <h3 class="estado__titulo">{{ titulo() }}</h3>
      @if (mensaje()) {
        <p class="estado__mensaje">{{ mensaje() }}</p>
      }
      <div class="estado__accion"><ng-content /></div>
    </div>
  `,
  styleUrl: './estado.scss',
})
export class EstadoVacio {
  readonly icono = input<NombreIcono>('bandeja');
  readonly titulo = input.required<string>();
  readonly mensaje = input<string>();
}

/** Estado de error de carga con botón "Reintentar". */
@Component({
  selector: 'app-estado-error',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icono],
  template: `
    <div class="estado estado--error" role="alert">
      <span class="estado__icono" aria-hidden="true"><app-icono nombre="alerta" /></span>
      <h3 class="estado__titulo">{{ titulo() }}</h3>
      @if (mensaje()) {
        <p class="estado__mensaje">{{ mensaje() }}</p>
      }
      <div class="estado__accion">
        <button type="button" class="btn btn--outline" (click)="reintentar.emit()">
          <app-icono nombre="reintentar" />
          Reintentar
        </button>
      </div>
    </div>
  `,
  styleUrl: './estado.scss',
})
export class EstadoError {
  readonly titulo = input('No se pudo cargar la información');
  readonly mensaje = input<string>();
  readonly reintentar = output<void>();
}
