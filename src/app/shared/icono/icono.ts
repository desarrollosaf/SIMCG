import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type NombreIcono =
  | 'editar'
  | 'basura'
  | 'lista'
  | 'mas'
  | 'cerrar'
  | 'agregar'
  | 'buscar'
  | 'descargar'
  | 'subir'
  | 'alerta'
  | 'reintentar'
  | 'check'
  | 'bandeja'
  | 'primera'
  | 'anterior'
  | 'siguiente'
  | 'ultima'
  | 'usuario'
  | 'usuarios'
  | 'usuarioX'
  | 'usuarioMas'
  | 'usuarioBuscar'
  | 'radar'
  | 'escudo'
  | 'edificio'
  | 'documento'
  | 'documentoCheck'
  | 'grafica'
  | 'pastel'
  | 'tendencia'
  | 'libro'
  | 'sobre'
  | 'engrane'
  | 'historial'
  | 'flechaIzq'
  | 'flechaDer'
  | 'chevron'
  | 'ayuda'
  | 'filtro';

// Trazos de un lienzo 24x24; se dibujan con currentColor.
const TRAZOS: Record<NombreIcono, readonly string[]> = {
  editar: ['M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z', 'm13 7 4 4'],
  basura: [
    'M5 7h14',
    'M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
    'm18 7-1 12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7',
  ],
  lista: ['M9 6h11', 'M9 12h11', 'M9 18h11', 'M4.5 6h.01', 'M4.5 12h.01', 'M4.5 18h.01'],
  filtro: ['M4 6h16', 'M7 12h10', 'M10 18h4'],
  mas: ['M12 5h.01', 'M12 12h.01', 'M12 19h.01'],
  cerrar: ['M6 6l12 12', 'M18 6 6 18'],
  agregar: ['M12 5v14', 'M5 12h14'],
  buscar: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z', 'm20 20-3.5-3.5'],
  descargar: ['M12 4v11', 'm7 11 5 5 5-5', 'M5 20h14'],
  subir: ['M12 16V5', 'm7 9 5-5 5 5', 'M5 20h14'],
  alerta: [
    'M12 4 2.8 19.5a1 1 0 0 0 .9 1.5h16.6a1 1 0 0 0 .9-1.5L12 4Z',
    'M12 10v4',
    'M12 17.5h.01',
  ],
  reintentar: ['M20 12a8 8 0 1 1-2.5-5.8', 'M20 4v5h-5'],
  check: ['M5 13l4 4L19 7'],
  primera: ['m17 17-5-5 5-5', 'M8 5v14'],
  anterior: ['m15 18-6-6 6-6'],
  siguiente: ['m9 18 6-6-6-6'],
  ultima: ['m7 7 5 5-5 5', 'M16 5v14'],
  bandeja: [
    'M4 13l2.5-7h11L20 13',
    'M4 13v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5',
    'M4 13h4.5l1 2h5l1-2H20',
  ],
  usuario: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4 20a8 8 0 0 1 16 0'],
  usuarios: [
    'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
    'M2.5 20a6.5 6.5 0 0 1 13 0',
    'M16 4.3a3.5 3.5 0 0 1 0 6.4',
    'M18 14a6.5 6.5 0 0 1 3.5 6',
  ],
  usuarioX: [
    'M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    'M3 20a7 7 0 0 1 11-5.7',
    'm16.5 15.5 5 5',
    'm21.5 15.5-5 5',
  ],
  usuarioMas: [
    'M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    'M3 20a7 7 0 0 1 11-5.7',
    'M19 14v6',
    'M16 17h6',
  ],
  usuarioBuscar: [
    'M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    'M3 20a7 7 0 0 1 8-6.9',
    'M17.5 20a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
    'm20 18.5 2 2',
  ],
  radar: [
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
    'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z',
    'M12 12l6-6',
    'M12 12h.01',
  ],
  escudo: ['M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z', 'm9 12 2 2 4-4'],
  edificio: [
    'M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16',
    'M14 10h5a1 1 0 0 1 1 1v10',
    'M2.5 21h19',
    'M8 8h2',
    'M8 12h2',
    'M8 16h2',
  ],
  documento: [
    'M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4Z',
    'M14 3v4h4',
    'M9 12h6',
    'M9 16h6',
  ],
  documentoCheck: [
    'M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4Z',
    'M14 3v4h4',
    'm9.5 14 2 2 3.5-4',
  ],
  grafica: ['M4 20V4', 'M4 20h16', 'M8 16v-4', 'M12 16V8', 'M16 16v-6'],
  pastel: ['M12 3v9h9', 'M20.5 15A9 9 0 1 1 9 3.5'],
  tendencia: ['m3 17 6-6 4 4 8-8', 'M15 7h6v6'],
  libro: [
    'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15Z',
    'M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3',
    'M9 7h6',
  ],
  sobre: [
    'M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z',
    'm3.5 7.5 8.5 6 8.5-6',
  ],
  engrane: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
  ],
  historial: ['M3.5 12a8.5 8.5 0 1 0 2.6-6.1', 'M3 4v4.5h4.5', 'M12 7.5V12l3 2'],
  flechaIzq: ['m11 17-5-5 5-5', 'm18 17-5-5 5-5'],
  flechaDer: ['m13 17 5-5-5-5', 'm6 17 5-5-5-5'],
  chevron: ['m6 9 6 6 6-6'],
  ayuda: [
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
    'M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8',
    'M12 17h.01',
  ],
};

/** Icono de línea en SVG en línea; hereda el color del texto. Siempre decorativo. */
@Component({
  selector: 'app-icono',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      @for (trazo of trazos(); track trazo) {
        <path [attr.d]="trazo" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      width: 1em;
      height: 1em;
      flex-shrink: 0;
    }

    svg {
      width: 100%;
      height: 100%;
    }
  `,
})
export class Icono {
  readonly nombre = input.required<NombreIcono>();

  protected readonly trazos = computed(() => TRAZOS[this.nombre()]);
}
