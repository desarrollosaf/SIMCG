import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Icono } from '../icono/icono';

/** Números de página (base 1) con elipsis (null): 1 … 4 5 6 … 20. */
export function paginasVisibles(actual: number, totalPaginas: number): (number | null)[] {
  if (totalPaginas <= 7) return Array.from({ length: totalPaginas }, (_, i) => i + 1);

  const inicio = Math.max(2, Math.min(actual - 1, totalPaginas - 3));
  const fin = Math.min(totalPaginas - 1, Math.max(actual + 1, 4));
  const paginas: (number | null)[] = [1];
  if (inicio > 2) paginas.push(null);
  for (let p = inicio; p <= fin; p++) paginas.push(p);
  if (fin < totalPaginas - 1) paginas.push(null);
  paginas.push(totalPaginas);
  return paginas;
}

/** Paginación del lado del servidor. `pagina` es base 0 (como el resto de la app). */
@Component({
  selector: 'app-paginador',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icono],
  templateUrl: './paginador.html',
  styleUrl: './paginador.scss',
})
export class Paginador {
  readonly pagina = input(0);
  readonly total = input(0);
  readonly limite = input(10);
  readonly tamanos = input<number[]>([10, 20, 50]);
  readonly deshabilitado = input(false);

  readonly paginaCambiada = output<number>();
  readonly limiteCambiado = output<number>();

  protected readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.limite())),
  );
  protected readonly desde = computed(() =>
    this.total() === 0 ? 0 : this.pagina() * this.limite() + 1,
  );
  protected readonly hasta = computed(() =>
    Math.min(this.total(), (this.pagina() + 1) * this.limite()),
  );
  protected readonly numeros = computed(() =>
    paginasVisibles(this.pagina() + 1, this.totalPaginas()),
  );
  protected readonly alInicio = computed(() => this.deshabilitado() || this.pagina() <= 0);
  protected readonly alFinal = computed(
    () => this.deshabilitado() || this.pagina() + 1 >= this.totalPaginas(),
  );

  protected formato(n: number): string {
    return n.toLocaleString('es-MX');
  }

  ir(pagina: number): void {
    if (this.deshabilitado() || pagina < 0 || pagina >= this.totalPaginas()) return;
    if (pagina !== this.pagina()) this.paginaCambiada.emit(pagina);
  }

  protected alCambiarLimite(evento: Event): void {
    this.limiteCambiado.emit(Number((evento.target as HTMLSelectElement).value));
  }
}
