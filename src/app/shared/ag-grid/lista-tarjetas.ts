import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AccionFila, MenuAcciones } from '../acciones/menu-acciones';
import { AvatarIniciales } from './avatar-iniciales';
import { ChipEstatus } from './chip-estatus';
import { EstadoVisual } from './estado-celda';

/**
 * Vista de tarjetas (una por fila) para pantallas angostas, alimentada con las mismas filas
 * que el grid: avatar, título, subtítulo, chip de estatus y menú ⋮. Las acciones se ofrecen solo desde el menú ⋮;
 * el texto de la tarjeta se puede seleccionar y copiar.
 */
@Component({
  selector: 'app-lista-tarjetas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarIniciales, ChipEstatus, MenuAcciones],
  templateUrl: './lista-tarjetas.html',
  styleUrl: './lista-tarjetas.scss',
})
export class ListaTarjetas<T = unknown> {
  readonly filas = input.required<T[]>();
  readonly acciones = input<AccionFila<T>[]>([]);
  readonly id = input.required<(fila: T) => string | number>();
  readonly titulo = input.required<(fila: T) => string>();
  readonly subtitulo = input<(fila: T) => string | null | undefined>();
  /** Segunda línea de contexto (p. ej. dependencia). */
  readonly detalle = input<(fila: T) => string | null | undefined>();
  readonly estatus = input<(fila: T) => EstadoVisual | null>();
  readonly etiqueta = input('Lista');
}
