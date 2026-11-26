import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AccionFila } from '../acciones/menu-acciones';
import { ListaTarjetas } from './lista-tarjetas';

interface Fila {
  id: number;
  nombre: string;
  curp: string;
  dep: string;
  baja: boolean;
}

@Component({
  imports: [ListaTarjetas],
  template: `<app-lista-tarjetas
    [filas]="filas"
    [acciones]="acciones"
    [id]="id"
    [titulo]="titulo"
    [subtitulo]="subtitulo"
    [detalle]="detalle"
    [estatus]="estatus"
  />`,
})
class Anfitrion {
  filas: Fila[] = [
    { id: 1, nombre: 'Ana López', curp: 'AAA1', dep: 'Tesorería', baja: false },
    { id: 2, nombre: 'Luis Pérez', curp: 'BBB2', dep: 'Contraloría', baja: true },
  ];
  editar = vi.fn();
  acciones: AccionFila<Fila>[] = [{ etiqueta: 'Editar', icono: 'editar', ejecutar: this.editar }];
  id = (f: Fila) => f.id;
  titulo = (f: Fila) => f.nombre;
  subtitulo = (f: Fila) => f.curp;
  detalle = (f: Fila) => f.dep;
  estatus = (f: Fila) =>
    f.baja ? { texto: 'Baja', tono: 'error' as const } : { texto: 'Obligado', tono: 'ok' as const };
}

describe('ListaTarjetas', () => {
  const montar = () => {
    const f = TestBed.createComponent(Anfitrion);
    f.detectChanges();
    return f;
  };

  it('dibuja una tarjeta por fila con avatar, nombre, CURP, detalle y chip', () => {
    const el: HTMLElement = montar().nativeElement;
    const tarjetas = el.querySelectorAll('.tarjeta');
    expect(tarjetas.length).toBe(2);
    expect(tarjetas[0].querySelector('app-avatar-iniciales')?.textContent?.trim()).toBe('AL');
    expect(tarjetas[0].querySelector('.tarjeta__titulo')?.textContent).toBe('Ana López');
    expect(tarjetas[0].querySelector('.tarjeta__sub')?.textContent).toBe('AAA1');
    expect(tarjetas[0].querySelector('.tarjeta__detalle')?.textContent).toBe('Tesorería');
    expect(tarjetas[1].querySelector('app-chip-estatus')?.getAttribute('data-tono')).toBe('error');
  });

  it('la tarjeta no es interactiva: no se enfoca ni abre nada al tocarla', () => {
    const f = montar();
    const tarjeta = f.nativeElement.querySelector('.tarjeta') as HTMLElement;
    expect(tarjeta.hasAttribute('tabindex')).toBe(false);
    expect(() => tarjeta.click()).not.toThrow();
  });

  it('el menú ⋮ ejecuta la acción con la fila', () => {
    const f = montar();
    (f.nativeElement.querySelector('app-menu-acciones button') as HTMLElement).click();
    f.detectChanges();
    (document.querySelector('.menu-acciones__item') as HTMLElement).click();
    expect(f.componentInstance.editar).toHaveBeenCalledWith(f.componentInstance.filas[0]);
  });
});

