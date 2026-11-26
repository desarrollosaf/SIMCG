import {
  Component,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import {
  MenuEntrada,
  MenuGrupo,
  MenuHoja,
  aplanarMenu,
  esGrupo,
  menuParaRoles,
  rutaActiva,
} from '../../core/access/menu';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { Icono, NombreIcono } from '../../shared/icono/icono';
import { BuscadorGlobal } from '../buscador-global/buscador-global';

const CLAVE_COLAPSADO = 'simcg.menu.colapsado';
const ANCHO_ANGOSTO = 980;
// En celular la isla se vuelve una barra horizontal arriba del contenido.
const ANCHO_MOVIL = 640;

const esMovil = (): boolean => typeof window !== 'undefined' && window.innerWidth <= ANCHO_MOVIL;

function leerColapsado(): boolean {
  try {
    const guardado = localStorage.getItem(CLAVE_COLAPSADO);
    if (guardado === '1') return true;
    if (guardado === '0') return false;
  } catch {
    // Sin almacenamiento: se usa el valor por defecto.
  }
  return typeof window !== 'undefined' && window.innerWidth < ANCHO_ANGOSTO;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink, RouterOutlet, BuscadorGlobal, Icono],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly temaService = inject(ThemeService);

  protected readonly user = this.authService.currentUser;
  protected readonly anio = new Date().getFullYear();
  // El inicio no aparece en el lateral (la ruta /home sigue existiendo).
  protected readonly menu = computed<MenuEntrada[]>(() =>
    menuParaRoles(this.user()?.roles).filter((e) => esGrupo(e) || e.ruta !== '/home'),
  );
  protected readonly rolesTexto = computed(() => this.user()?.roles.join(', ') ?? '');
  protected readonly iniciales = computed(() => {
    const partes = (this.user()?.nombre ?? '').trim().split(/\s+/).filter(Boolean);
    return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || '?';
  });

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  protected readonly activa = computed(() => rutaActiva(this.url(), aplanarMenu(this.menu())));

  protected readonly colapsado = signal(leerColapsado());
  /** Celular: siempre la isla (horizontal), sin menú expandido. */
  protected readonly movil = signal(esMovil());
  /** Grupos desplegados en el lateral expandido (pueden ser varios). */
  protected readonly expandidos = signal<ReadonlySet<string>>(new Set());
  /** Grupo cuyo panel flotante está abierto en el modo colapsado. */
  protected readonly panelGrupo = signal<MenuGrupo | null>(null);
  protected readonly panelTop = signal(0);
  protected readonly usuarioAbierto = signal(false);

  protected readonly esGrupo = esGrupo;

  constructor() {
    // El grupo con la ruta activa queda desplegado.
    effect(() => {
      const activa = this.activa();
      const grupo = this.menu().find(
        (e): e is MenuGrupo => esGrupo(e) && e.hijos.some((h) => h.ruta === activa),
      );
      if (grupo) {
        untracked(() => {
          if (!this.expandidos().has(grupo.etiqueta)) {
            this.expandidos.update((s) => new Set(s).add(grupo.etiqueta));
          }
        });
      }
    });

    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.cerrarPaneles();
      // En pantallas angostas el lateral expandido es una capa: se cierra al navegar.
      if (window.innerWidth < ANCHO_ANGOSTO) this.colapsado.set(true);
    });
  }

  protected grupoActivo(grupo: MenuGrupo): boolean {
    const activa = this.activa();
    return !!activa && grupo.hijos.some((h) => h.ruta === activa);
  }

  protected nombreCorto(entrada: MenuGrupo | MenuHoja): string {
    return entrada.corto ?? entrada.etiqueta;
  }

  protected iconoHoja(hoja: MenuHoja): NombreIcono {
    return hoja.icono ?? 'documento';
  }

  protected alternarColapsado(): void {
    const valor = !this.colapsado();
    this.colapsado.set(valor);
    this.cerrarPaneles();
    try {
      localStorage.setItem(CLAVE_COLAPSADO, valor ? '1' : '0');
    } catch {
      // Sin almacenamiento: no se persiste.
    }
  }

  protected alternarGrupo(grupo: MenuGrupo): void {
    this.expandidos.update((s) => {
      const nuevo = new Set(s);
      if (!nuevo.delete(grupo.etiqueta)) nuevo.add(grupo.etiqueta);
      return nuevo;
    });
  }

  protected alternarPanel(grupo: MenuGrupo, evento: Event): void {
    this.usuarioAbierto.set(false);
    if (this.panelGrupo() === grupo) {
      this.panelGrupo.set(null);
      return;
    }
    const caja = (evento.currentTarget as HTMLElement).getBoundingClientRect();
    // En celular el panel se abre debajo de la barra; en escritorio, a la altura del botón.
    this.panelTop.set(this.movil() ? caja.bottom + 6 : Math.max(8, caja.top - 6));
    this.panelGrupo.set(grupo);
  }

  protected alternarUsuario(): void {
    this.panelGrupo.set(null);
    this.usuarioAbierto.update((v) => !v);
  }

  protected cerrarPaneles(): void {
    this.panelGrupo.set(null);
    this.usuarioAbierto.set(false);
  }

  @HostListener('document:click', ['$event'])
  protected clicFuera(evento: Event): void {
    const destino = evento.target as HTMLElement | null;
    if (this.usuarioAbierto() && !destino?.closest('.usr')) this.usuarioAbierto.set(false);
    if (this.panelGrupo() && !destino?.closest('.flotante, .mod')) this.panelGrupo.set(null);
  }

  @HostListener('document:keydown', ['$event'])
  protected teclado(evento: KeyboardEvent): void {
    if (evento.key === 'Escape' && (this.panelGrupo() || this.usuarioAbierto())) {
      this.cerrarPaneles();
    }
  }

  @HostListener('window:resize')
  protected alRedimensionar(): void {
    this.movil.set(esMovil());
    this.cerrarPaneles();
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }
}
