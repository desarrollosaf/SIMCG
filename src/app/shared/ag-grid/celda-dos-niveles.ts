import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { AvatarIniciales } from './avatar-iniciales';

export interface CeldaDosNivelesParams<T = unknown> extends ICellRendererParams<T> {
  /** Texto principal (negritas). */
  principal: (fila: T) => string | null | undefined;
  /** Texto secundario, más chico y atenuado, debajo del principal. */
  secundario?: (fila: T) => string | null | undefined;
  /** Muestra un avatar con las iniciales del texto principal. */
  avatar?: boolean;
  /** Secundario en tipografía monoespaciada (CURP, folios…). */
  monoSecundario?: boolean;
}

interface Contenido {
  principal: string;
  secundario: string;
}

/** Celda de dos niveles (principal + secundario) para tablas sin scroll horizontal. */
@Component({
  selector: 'app-celda-dos-niveles',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarIniciales],
  template: `
    @if (avatar()) {
      <app-avatar-iniciales [nombre]="contenido().principal" />
    }
    <div class="textos">
      <span class="principal" [title]="contenido().principal">{{ contenido().principal }}</span>
      @if (contenido().secundario) {
        <span class="secundario" [class.mono]="mono()" [title]="contenido().secundario">{{
          contenido().secundario
        }}</span>
      }
    </div>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      min-height: 100%;
      min-width: 0;
      padding: 8px 0;
    }

    .textos {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-width: 0;
      line-height: 1.25;
    }

    .principal,
    .secundario {
      overflow-wrap: break-word;
      white-space: normal;
    }

    .principal {
      font-weight: 600;
      color: var(--ink);
    }

    .secundario {
      font-size: 0.78rem;
      color: var(--muted);
    }

    .mono {
      font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
      font-size: 0.74rem;
      letter-spacing: 0.02em;
    }
  `,
})
export class CeldaDosNiveles<T = unknown> implements ICellRendererAngularComp {
  protected readonly contenido = signal<Contenido>({ principal: '', secundario: '' });
  protected readonly avatar = signal(false);
  protected readonly mono = signal(false);

  agInit(params: CeldaDosNivelesParams<T>): void {
    this.refresh(params);
  }

  refresh(params: CeldaDosNivelesParams<T>): boolean {
    const fila = params.data;
    this.avatar.set(!!params.avatar);
    this.mono.set(!!params.monoSecundario);
    this.contenido.set(
      fila
        ? {
            principal: params.principal(fila) ?? '',
            secundario: params.secundario?.(fila) ?? '',
          }
        : { principal: '', secundario: '' },
    );
    return true;
  }
}
