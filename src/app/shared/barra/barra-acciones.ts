import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AccionGeneral, MenuAcciones } from '../acciones/menu-acciones';

/**
 * Encabezado de página con título, subtítulo, contador, buscador y acciones.
 * Proyecta `[barra-busqueda]` y `[barra-acciones]` (solo UN botón primario visible);
 * las acciones secundarias (reportes, exportaciones…) van en `masAcciones`, menú «Más ⋮».
 */
@Component({
  selector: 'app-barra-acciones',
  standalone: true,
  imports: [MenuAcciones],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="barra">
      <div class="barra__titulo">
        <h2>
          {{ titulo() }}
          @if (contador() !== undefined && contador() !== null) {
            <span class="barra__contador" aria-label="Total de registros">{{ contador() }}</span>
          }
        </h2>
        @if (subtitulo()) {
          <p>{{ subtitulo() }}</p>
        }
      </div>
      <div class="barra__herramientas">
        <ng-content select="[barra-busqueda]" />
        <div class="barra__acciones">
          <ng-content select="[barra-acciones]" />
          @if (masAcciones().length) {
            <app-menu-acciones
              [acciones]="masAcciones()"
              variante="barra"
              etiqueta="Más acciones"
            />
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './barra-acciones.scss',
})
export class BarraAcciones {
  readonly titulo = input.required<string>();
  readonly subtitulo = input<string>();
  readonly contador = input<number | string | null>();
  /** Acciones secundarias; con alguna visible aparece el botón «Más ⋮». */
  readonly masAcciones = input<AccionGeneral[]>([]);
}
