import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { MenuGrupo, aplanarMenu, esGrupo, menuParaRoles, rutaActiva } from '../../core/access/menu';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { BuscadorGlobal } from '../buscador-global/buscador-global';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink, RouterOutlet, BuscadorGlobal],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly temaService = inject(ThemeService);

  protected readonly user = this.authService.currentUser;
  protected readonly anio = new Date().getFullYear();
  protected readonly menu = computed(() => menuParaRoles(this.user()?.roles));
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

  /** Clave del desplegable abierto: etiqueta del grupo o 'usuario'. */
  protected readonly abierto = signal<string | null>(null);
  protected readonly topPanel = signal<number | null>(null);

  protected readonly esGrupo = esGrupo;

  constructor() {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.cerrar());
  }

  protected grupoActivo(grupo: MenuGrupo): boolean {
    const activa = this.activa();
    return !!activa && grupo.hijos.some((h) => h.ruta === activa);
  }

  protected alternar(clave: string, evento: Event): void {
    evento.stopPropagation();
    if (this.abierto() === clave) {
      this.cerrar();
      return;
    }
    // En pantallas angostas el panel es fixed, justo debajo de la isla.
    const isla = (evento.currentTarget as HTMLElement).closest('.nav');
    const angosto = window.matchMedia('(max-width: 980px)').matches;
    this.topPanel.set(isla && angosto ? isla.getBoundingClientRect().bottom + 10 : null);
    this.abierto.set(clave);
  }

  protected cerrar(): void {
    this.abierto.set(null);
  }

  @HostListener('document:click', ['$event'])
  protected clicFuera(evento: Event): void {
    if (this.abierto() && !(evento.target as HTMLElement).closest('.it')) this.cerrar();
  }

  @HostListener('document:keydown', ['$event'])
  protected teclado(evento: KeyboardEvent): void {
    if (evento.key === 'Escape' && this.abierto()) {
      this.cerrar();
    }
  }

  @HostListener('window:resize')
  protected alRedimensionar(): void {
    this.cerrar();
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }
}
