import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Ayuda } from './ayuda';

@Component({
  standalone: true,
  imports: [Ayuda],
  template: `<app-ayuda titulo="Cómo cargar"><p class="texto">Instrucciones</p></app-ayuda>`,
})
class Anfitrion {}

describe('Ayuda', () => {
  const crear = () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    return fixture;
  };
  const el = (f: ReturnType<typeof crear>) => f.nativeElement as HTMLElement;

  it('muestra solo el botón al inicio', () => {
    const f = crear();
    expect(el(f).querySelector('.ayuda__boton')?.textContent).toContain('Ayuda');
    expect(el(f).querySelector('.ayuda__panel')).toBeNull();
  });

  it('abre el panel con el título y el contenido proyectado', () => {
    const f = crear();
    (el(f).querySelector('.ayuda__boton') as HTMLButtonElement).click();
    f.detectChanges();
    expect(el(f).querySelector('.ayuda__titulo')?.textContent).toContain('Cómo cargar');
    expect(el(f).querySelector('.ayuda__panel .texto')).not.toBeNull();
  });

  it('cierra con la X, el fondo y Esc', () => {
    const f = crear();
    const abrir = () => {
      (el(f).querySelector('.ayuda__boton') as HTMLButtonElement).click();
      f.detectChanges();
    };
    abrir();
    (el(f).querySelector('.ayuda__cerrar') as HTMLButtonElement).click();
    f.detectChanges();
    expect(el(f).querySelector('.ayuda__panel')).toBeNull();

    abrir();
    (el(f).querySelector('.ayuda__fondo') as HTMLElement).click();
    f.detectChanges();
    expect(el(f).querySelector('.ayuda__panel')).toBeNull();

    abrir();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    f.detectChanges();
    expect(el(f).querySelector('.ayuda__panel')).toBeNull();
  });
});
