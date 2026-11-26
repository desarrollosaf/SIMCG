import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AccionFila, MenuAcciones } from './menu-acciones';

interface Fila {
  id: number;
}

@Component({
  imports: [MenuAcciones],
  template: `<app-menu-acciones [acciones]="acciones" [fila]="fila()" [variante]="variante" />`,
})
class Anfitrion {
  fila = signal<Fila>({ id: 7 });
  variante: 'celda' | 'barra' = 'celda';
  baja = vi.fn();
  ver = vi.fn();
  acciones: AccionFila<Fila>[] = [
    { etiqueta: 'Dar de baja', icono: 'basura', peligro: true, ejecutar: this.baja },
    { etiqueta: 'Ver', icono: 'lista', ejecutar: this.ver },
  ];
}

describe('MenuAcciones', () => {
  const abrir = () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    const boton = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    boton.click();
    fixture.detectChanges();
    return fixture;
  };
  const items = () => Array.from(document.querySelectorAll<HTMLElement>('.menu-acciones__item'));

  it('pone las acciones de peligro al final aunque vengan primero', () => {
    abrir();
    expect(items().map((i) => i.textContent?.trim())).toEqual(['Ver', 'Dar de baja']);
    expect(items()[1].classList).toContain('menu-acciones__item--peligro');
  });

  it('ejecuta la acción con la fila recibida', () => {
    const fixture = abrir();
    items()[0].click();
    expect(fixture.componentInstance.ver).toHaveBeenCalledWith({ id: 7 });
  });

  it('el clic en ⋮ no se propaga a la fila', () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    const alPadre = vi.fn();
    (fixture.nativeElement as HTMLElement).addEventListener('click', alPadre);
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    expect(alPadre).not.toHaveBeenCalled();
  });

  it('cierra con Escape', () => {
    const fixture = abrir();
    expect(items().length).toBe(2);
    items()[0].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }),
    );
    fixture.detectChanges();
    expect(items().length).toBe(0);
  });

  it('la variante barra muestra el texto «Más»', () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.componentInstance.variante = 'barra';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button').textContent).toContain('Más');
  });
});
