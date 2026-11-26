import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TonoEstado } from './estado-celda';

/** Insignia (chip) de estatus; el color sale del tono. */
@Component({
  selector: 'app-chip-estatus',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ texto() }}`,
  host: { '[attr.data-tono]': 'tono()' },
  styles: `
    :host {
      display: inline-block;
      padding: 0.15rem 0.65rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 700;
      line-height: 1.4;
      white-space: nowrap;
      background: var(--surface-2);
      color: var(--brand-muted);
    }

    :host([data-tono='ok']) {
      background: var(--success-bg);
      color: var(--success-ink);
    }

    :host([data-tono='error']) {
      background: var(--danger-soft);
      color: var(--brand-danger);
    }

    :host([data-tono='info']) {
      background: var(--info-bg);
      color: var(--info-ink);
    }
  `,
})
export class ChipEstatus {
  readonly texto = input.required<string>();
  readonly tono = input<TonoEstado>('neutro');
}
