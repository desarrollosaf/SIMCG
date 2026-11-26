import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Iniciales (máx. 2) de un nombre: «ANA LÓPEZ DÍAZ» → «AL». */
export function iniciales(nombre: string | null | undefined): string {
  const palabras = (nombre ?? '').trim().split(/\s+/).filter(Boolean);
  return palabras
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toLocaleUpperCase('es-MX');
}

/** Círculo con las iniciales de una persona. */
@Component({
  selector: 'app-avatar-iniciales',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ texto() }}`,
  host: { 'aria-hidden': 'true' },
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
      flex: none;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: var(--brand-primary-soft);
      color: var(--accent-text);
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      user-select: none;
    }
  `,
})
export class AvatarIniciales {
  readonly nombre = input<string | null>('');
  protected readonly texto = computed(() => iniciales(this.nombre()));
}
