import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { MenuHojaConGrupo, aplanarMenu, menuParaRoles } from '../../core/access/menu';
import { AuthService } from '../../core/services/auth.service';
import { ServidoresService } from '../../core/services/servidores.service';

export interface Segmento {
  texto: string;
  resaltado: boolean;
}

export interface Resultado {
  id: string;
  titulo: Segmento[];
  detalle: Segmento[];
  destino: string;
}

export const MIN_CARACTERES = 3;
export const MAX_SERVIDORES = 6;
export const MAX_MODULOS = 6;

const MARCAS_COMBINADAS = /[̀-ͯ]/g;

/** Minúsculas y sin acentos, conservando un mapa hacia las posiciones originales. */
function normalizarConMapa(texto: string): { norm: string; mapa: number[] } {
  let norm = '';
  const mapa: number[] = [];
  for (let i = 0; i < texto.length; i++) {
    const n = texto[i].toLowerCase().normalize('NFD').replace(MARCAS_COMBINADAS, '');
    for (const c of n) {
      norm += c;
      mapa.push(i);
    }
  }
  return { norm, mapa };
}

export function normalizar(texto: string): string {
  return normalizarConMapa(texto).norm;
}

/** Divide el texto en segmentos marcando las coincidencias (sin acentos ni mayúsculas). */
export function resaltar(texto: string, consulta: string): Segmento[] {
  const q = normalizar(consulta.trim());
  if (!texto) return [];
  if (!q) return [{ texto, resaltado: false }];
  const { norm, mapa } = normalizarConMapa(texto);
  const segmentos: Segmento[] = [];
  let cursor = 0;
  let desde = 0;
  for (;;) {
    const pos = norm.indexOf(q, desde);
    if (pos < 0) break;
    const ini = mapa[pos];
    const fin = mapa[pos + q.length - 1] + 1;
    if (ini > cursor) segmentos.push({ texto: texto.slice(cursor, ini), resaltado: false });
    segmentos.push({ texto: texto.slice(ini, fin), resaltado: true });
    cursor = fin;
    desde = pos + q.length;
  }
  if (cursor < texto.length) segmentos.push({ texto: texto.slice(cursor), resaltado: false });
  return segmentos;
}

/** Módulos del menú (ya filtrado por rol) que coinciden con la consulta. */
export function filtrarModulos(
  destinos: readonly MenuHojaConGrupo[],
  consulta: string,
): MenuHojaConGrupo[] {
  const q = normalizar(consulta.trim());
  if (!q) return [];
  return destinos
    .filter((d) => normalizar(`${d.etiqueta} ${d.grupo ?? ''}`).includes(q))
    .slice(0, MAX_MODULOS);
}

@Component({
  selector: 'app-buscador-global',
  standalone: true,
  templateUrl: './buscador-global.html',
  styleUrl: './buscador-global.scss',
})
export class BuscadorGlobal {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly servidoresService = inject(ServidoresService);
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly entrada = viewChild<ElementRef<HTMLInputElement>>('entrada');
  protected readonly icono = viewChild<ElementRef<HTMLButtonElement>>('icono');
  protected readonly texto = signal('');
  protected readonly seleccion = signal(0);
  protected readonly cargando = signal(false);
  protected readonly enfocado = signal(false);
  /** El campo solo se muestra tras pulsar la lupa (o Ctrl+K); si no, solo el icono. */
  protected readonly expandido = signal(false);
  /** En pantallas angostas el campo es fixed, justo debajo de la isla. */
  protected readonly topCaja = signal<number | null>(null);
  private readonly servidores = signal<Resultado[]>([]);
  private readonly consulta$ = new Subject<string>();

  private readonly destinos = computed<MenuHojaConGrupo[]>(() =>
    aplanarMenu(menuParaRoles(this.auth.currentUser()?.roles)),
  );

  private readonly consulta = computed(() => this.texto().trim());

  protected readonly modulos = computed<Resultado[]>(() => {
    const q = this.consulta();
    return filtrarModulos(this.destinos(), q).map((d) => ({
      id: `bg-mod-${d.ruta}`,
      titulo: resaltar(d.etiqueta, q),
      detalle: resaltar(d.grupo ?? '', q),
      destino: d.ruta,
    }));
  });

  protected readonly servidoresVisibles = computed(() =>
    this.consulta().length >= MIN_CARACTERES ? this.servidores() : [],
  );

  protected readonly resultados = computed(() => [...this.modulos(), ...this.servidoresVisibles()]);
  protected readonly abierto = computed(() => this.enfocado() && this.consulta() !== '');
  protected readonly pocosCaracteres = computed(
    () => this.consulta() !== '' && this.consulta().length < MIN_CARACTERES,
  );
  protected readonly sinResultados = computed(
    () => !this.cargando() && !this.pocosCaracteres() && this.resultados().length === 0,
  );
  protected readonly activoId = computed(() =>
    this.abierto() ? (this.resultados()[this.seleccion()]?.id ?? null) : null,
  );

  constructor() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.colapsar(false));

    this.consulta$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap((q) => {
          if (q.length < MIN_CARACTERES) {
            this.servidores.set([]);
            this.cargando.set(false);
          } else {
            this.cargando.set(true);
          }
        }),
        // switchMap cancela la petición anterior cuando llega una consulta nueva.
        switchMap((q) =>
          q.length < MIN_CARACTERES
            ? of(null)
            : this.servidoresService
                .listar({
                  inicio: 0,
                  limite: MAX_SERVIDORES,
                  buscar: q,
                  ordenar: 'nombre',
                  direccion: 'asc',
                })
                .pipe(
                  map((pagina) => ({ q, pagina })),
                  catchError(() => of({ q, pagina: null })),
                ),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((res) => {
        if (!res) return;
        // Respuesta de una consulta que ya no es la vigente: se descarta.
        if (res.q !== this.consulta()) return;
        this.cargando.set(false);
        this.servidores.set(
          (res.pagina?.filas ?? []).map((f) => ({
            id: `bg-srv-${f.id}`,
            titulo: resaltar(f.nombre, res.q),
            detalle: resaltar(f.curp ?? '', res.q),
            destino: `/servidores/${f.id}/movimientos`,
          })),
        );
        if (this.seleccion() >= this.resultados().length) this.seleccion.set(0);
      });
  }

  protected escribir(valor: string): void {
    this.texto.set(valor);
    this.seleccion.set(0);
    if (valor.trim().length < MIN_CARACTERES) {
      this.servidores.set([]);
      this.cargando.set(false);
    }
    this.consulta$.next(valor.trim());
  }

  protected alEnfocar(): void {
    this.enfocado.set(true);
  }

  protected alDesenfocar(): void {
    this.enfocado.set(false);
    if (!this.texto().trim()) this.colapsar(false);
  }

  /** Muestra el campo (si estaba colapsado) y le da el foco. */
  abrir(): void {
    const isla = this.host.nativeElement.closest('.nav');
    const angosto = window.matchMedia?.('(max-width: 980px)').matches ?? false;
    this.topCaja.set(isla && angosto ? isla.getBoundingClientRect().bottom + 10 : null);
    this.expandido.set(true);
    this.cdr.detectChanges();
    const el = this.entrada()?.nativeElement;
    el?.focus();
    el?.select();
  }

  /** Vuelve a mostrar solo la lupa; con `devolverFoco` el foco regresa a ella. */
  private colapsar(devolverFoco: boolean): void {
    if (!this.expandido()) return;
    this.limpiar();
    this.expandido.set(false);
    if (devolverFoco) {
      this.cdr.detectChanges();
      this.icono()?.nativeElement.focus();
    }
  }

  @HostListener('document:click', ['$event'])
  protected clicFuera(evento: Event): void {
    if (this.expandido() && !this.host.nativeElement.contains(evento.target as Node)) {
      this.colapsar(false);
    }
  }

  @HostListener('document:keydown', ['$event'])
  protected atajo(evento: KeyboardEvent): void {
    if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
      evento.preventDefault();
      this.abrir();
    }
  }

  protected teclado(evento: KeyboardEvent): void {
    const total = this.resultados().length;
    switch (evento.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        if (!total || !this.abierto()) return;
        evento.preventDefault();
        this.seleccion.update((i) => (i + (evento.key === 'ArrowDown' ? 1 : -1) + total) % total);
        document.getElementById(this.activoId() ?? '')?.scrollIntoView?.({ block: 'nearest' });
        break;
      case 'Enter': {
        const r = this.resultados()[this.seleccion()];
        if (r && this.abierto()) {
          evento.preventDefault();
          this.ir(r);
        }
        break;
      }
      case 'Escape':
        evento.preventDefault();
        this.colapsar(true);
        break;
    }
  }

  protected ir(r: Resultado): void {
    this.colapsar(false);
    void this.router.navigateByUrl(r.destino);
  }

  private limpiar(): void {
    this.texto.set('');
    this.seleccion.set(0);
    this.servidores.set([]);
    this.cargando.set(false);
    this.consulta$.next('');
  }

  protected indice(r: Resultado): number {
    return this.resultados().findIndex((x) => x.id === r.id);
  }
}
