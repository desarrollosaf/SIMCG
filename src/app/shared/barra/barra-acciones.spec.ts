import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AccionGeneral } from '../acciones/menu-acciones';
import { BarraAcciones } from './barra-acciones';

@Component({
  imports: [BarraAcciones],
  template: `<app-barra-acciones titulo="Servidores" [contador]="12" [masAcciones]="mas()">
    <button barra-acciones class="primario">Nuevo</button>
  </app-barra-acciones>`,
})
class Anfitrion {
  exportar = vi.fn();
  mas = signal<AccionGeneral[]>([]);
}

describe('BarraAcciones', () => {
  it('muestra título, contador y el botón primario proyectado', () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h2')?.textContent).toContain('Servidores');
    expect(el.querySelector('.barra__contador')?.textContent).toContain('12');
    expect(el.querySelector('.primario')).toBeTruthy();
  });

  it('sin acciones secundarias no dibuja el menú «Más»', () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-menu-acciones')).toBeNull();
  });

  it('con acciones secundarias ofrece «Más ⋮» y las ejecuta', () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.componentInstance.mas.set([
      { etiqueta: 'Exportar', icono: 'descargar', ejecutar: fixture.componentInstance.exportar },
    ]);
    fixture.detectChanges();
    const boton = fixture.nativeElement.querySelector('app-menu-acciones button') as HTMLElement;
    expect(boton.textContent).toContain('Más');
    boton.click();
    fixture.detectChanges();
    (document.querySelector('.menu-acciones__item') as HTMLElement).click();
    expect(fixture.componentInstance.exportar).toHaveBeenCalled();
  });
});
