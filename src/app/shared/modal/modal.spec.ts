import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Modal } from './modal';

@Component({
  imports: [Modal],
  template: `
    @if (abierto()) {
      <app-modal
        titulo="Prueba"
        subtitulo="Sub"
        [bloqueado]="bloqueado()"
        (cerrar)="cierres.set(cierres() + 1)"
      >
        <p class="cuerpo">Hola</p>
        <button modal-pie class="pie">Aceptar</button>
      </app-modal>
    }
    @if (anidado()) {
      <app-modal titulo="Anidado" (cerrar)="anidado.set(false)">x</app-modal>
    }
  `,
})
class Anfitrion {
  abierto = signal(true);
  anidado = signal(false);
  bloqueado = signal(false);
  cierres = signal(0);
}

const esc = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

describe('Modal', () => {
  const crear = () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    return fixture;
  };

  it('muestra título, subtítulo, cuerpo y pie proyectados con rol de diálogo', () => {
    const el: HTMLElement = crear().nativeElement;
    expect(el.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true');
    expect(el.querySelector('.modal__titulo')?.textContent).toContain('Prueba');
    expect(el.querySelector('.modal__subtitulo')?.textContent).toContain('Sub');
    expect(el.querySelector('.cuerpo')).toBeTruthy();
    expect(el.querySelector('.modal__pie .pie')).toBeTruthy();
  });

  it('Esc y clic en el fondo emiten cerrar', () => {
    const fixture = crear();
    esc();
    expect(fixture.componentInstance.cierres()).toBe(1);
    (fixture.nativeElement.querySelector('.modal__fondo') as HTMLElement).click();
    expect(fixture.componentInstance.cierres()).toBe(2);
  });

  it('el botón de cerrar emite cerrar', () => {
    const fixture = crear();
    (fixture.nativeElement.querySelector('.modal__cerrar') as HTMLButtonElement).click();
    expect(fixture.componentInstance.cierres()).toBe(1);
  });

  it('bloqueado impide cerrar por Esc, fondo y botón', () => {
    const fixture = crear();
    fixture.componentInstance.bloqueado.set(true);
    fixture.detectChanges();
    esc();
    (fixture.nativeElement.querySelector('.modal__fondo') as HTMLElement).click();
    (fixture.nativeElement.querySelector('.modal__cerrar') as HTMLButtonElement).click();
    expect(fixture.componentInstance.cierres()).toBe(0);
  });

  it('bloquea el scroll del body mientras hay modales y solo el superior responde a Esc', () => {
    const fixture = crear();
    expect(document.body.classList.contains('modal-abierto')).toBe(true);

    fixture.componentInstance.anidado.set(true);
    fixture.detectChanges();
    esc();
    expect(fixture.componentInstance.anidado()).toBe(false);
    expect(fixture.componentInstance.cierres()).toBe(0);
    expect(document.body.classList.contains('modal-abierto')).toBe(true);

    fixture.destroy();
    expect(document.body.classList.contains('modal-abierto')).toBe(false);
  });
});
