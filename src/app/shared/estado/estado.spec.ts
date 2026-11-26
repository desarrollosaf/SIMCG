import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EstadoError, EstadoVacio } from './estado';

@Component({
  imports: [EstadoVacio, EstadoError],
  template: `
    <app-estado-vacio titulo="Sin datos" mensaje="Nada por aquí"
      ><button class="accion">Crear</button></app-estado-vacio
    >
    <app-estado-error mensaje="Falló" (reintentar)="reintentos = reintentos + 1" />
  `,
})
class Anfitrion {
  reintentos = 0;
}

describe('Estados', () => {
  it('estado vacío muestra título, mensaje y la acción proyectada', () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    const vacio = fixture.nativeElement.querySelector('app-estado-vacio') as HTMLElement;
    expect(vacio.textContent).toContain('Sin datos');
    expect(vacio.textContent).toContain('Nada por aquí');
    expect(vacio.querySelector('.accion')).toBeTruthy();
  });

  it('estado de error es una alerta y emite reintentar', () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    const error = fixture.nativeElement.querySelector('app-estado-error') as HTMLElement;
    expect(error.querySelector('[role="alert"]')).toBeTruthy();
    (error.querySelector('button') as HTMLButtonElement).click();
    expect(fixture.componentInstance.reintentos).toBe(1);
  });
});
