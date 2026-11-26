import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FiltrosPopover } from './filtros-popover';

@Component({
  imports: [FiltrosPopover],
  template: `<app-filtros-popover [activos]="activos()" (limpiar)="limpiados = limpiados + 1">
    <span class="contenido">Controles</span>
  </app-filtros-popover>`,
})
class Anfitrion {
  activos = signal(0);
  limpiados = 0;
}

describe('FiltrosPopover', () => {
  const montar = () => {
    const f = TestBed.createComponent(Anfitrion);
    f.detectChanges();
    return f;
  };
  const boton = (f: ReturnType<typeof montar>) =>
    f.nativeElement.querySelector('.boton-filtros') as HTMLElement;

  afterEach(() => document.querySelector('.cdk-overlay-container')?.replaceChildren());

  it('cerrado no muestra los controles; sin filtros no hay insignia', () => {
    const f = montar();
    expect(document.querySelector('.contenido')).toBeNull();
    expect(f.nativeElement.querySelector('.insignia')).toBeNull();
  });

  it('muestra la insignia con el número de filtros activos', () => {
    const f = montar();
    f.componentInstance.activos.set(2);
    f.detectChanges();
    expect(f.nativeElement.querySelector('.insignia').textContent.trim()).toBe('2');
  });

  it('abre al hacer clic y cierra con Escape', () => {
    const f = montar();
    boton(f).click();
    f.detectChanges();
    expect(document.querySelector('.panel .contenido')).toBeTruthy();
    expect(boton(f).getAttribute('aria-expanded')).toBe('true');

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    f.detectChanges();
    expect(document.querySelector('.panel')).toBeNull();
  });

  it('«Limpiar filtros» solo aparece con filtros activos y emite limpiar', () => {
    const f = montar();
    boton(f).click();
    f.detectChanges();
    expect(document.querySelector('.panel__pie')).toBeNull();

    f.componentInstance.activos.set(1);
    f.detectChanges();
    (document.querySelector('.panel__pie button') as HTMLElement).click();
    expect(f.componentInstance.limpiados).toBe(1);
  });
});
