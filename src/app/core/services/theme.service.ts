import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

export type Tema = 'claro' | 'oscuro';

export const CLAVE_TEMA = 'simcg-tema';

function leerGuardado(): Tema | null {
  try {
    const valor = localStorage.getItem(CLAVE_TEMA);
    return valor === 'claro' || valor === 'oscuro' ? valor : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  readonly tema = signal<Tema>(leerGuardado() ?? this.preferenciaSistema());

  constructor() {
    effect(() => this.aplicar(this.tema()));
  }

  alternar(): void {
    this.establecer(this.tema() === 'oscuro' ? 'claro' : 'oscuro');
  }

  establecer(tema: Tema): void {
    this.tema.set(tema);
    try {
      localStorage.setItem(CLAVE_TEMA, tema);
    } catch {
      // Sin almacenamiento disponible: el tema solo dura la sesión.
    }
  }

  private aplicar(tema: Tema): void {
    const raiz = this.document.documentElement;
    raiz.setAttribute('data-bs-theme', tema === 'oscuro' ? 'dark' : 'light');
    raiz.classList.toggle('tema-oscuro', tema === 'oscuro');
    raiz.classList.toggle('tema-claro', tema === 'claro');
  }

  private preferenciaSistema(): Tema {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
    } catch {
      return 'claro';
    }
  }
}
