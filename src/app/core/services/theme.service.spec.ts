import { TestBed } from '@angular/core/testing';
import { CLAVE_TEMA, ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.removeItem(CLAVE_TEMA);
    document.documentElement.removeAttribute('data-bs-theme');
    document.documentElement.classList.remove('tema-oscuro', 'tema-claro');
  });

  afterEach(() => localStorage.removeItem(CLAVE_TEMA));

  it('usa el tema guardado', () => {
    localStorage.setItem(CLAVE_TEMA, 'oscuro');
    const servicio = TestBed.inject(ThemeService);
    expect(servicio.tema()).toBe('oscuro');
  });

  it('ignora valores guardados inválidos', () => {
    localStorage.setItem(CLAVE_TEMA, 'rojo');
    const servicio = TestBed.inject(ThemeService);
    expect(['claro', 'oscuro']).toContain(servicio.tema());
  });

  it('alterna, aplica el atributo en <html> y persiste', () => {
    const servicio = TestBed.inject(ThemeService);
    servicio.establecer('claro');
    servicio.alternar();
    TestBed.tick();

    const raiz = document.documentElement;
    expect(servicio.tema()).toBe('oscuro');
    expect(raiz.getAttribute('data-bs-theme')).toBe('dark');
    expect(raiz.classList.contains('tema-oscuro')).toBe(true);
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('oscuro');

    servicio.alternar();
    TestBed.tick();
    expect(raiz.getAttribute('data-bs-theme')).toBe('light');
    expect(raiz.classList.contains('tema-claro')).toBe(true);
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('claro');
  });
});
