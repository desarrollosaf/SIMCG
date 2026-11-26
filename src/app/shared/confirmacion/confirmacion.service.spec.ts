import { TestBed } from '@angular/core/testing';
import { ConfirmacionHost } from './confirmacion-host';
import { ConfirmacionService } from './confirmacion.service';

describe('ConfirmacionService', () => {
  it('resuelve true al confirmar y false al cancelar', async () => {
    const servicio = TestBed.inject(ConfirmacionService);

    const si = servicio.confirmar({ titulo: 'T', mensaje: 'M' });
    expect(servicio.actual()?.titulo).toBe('T');
    servicio.actual()!.responder(true);
    expect(await si).toBe(true);
    expect(servicio.actual()).toBeNull();

    const no = servicio.confirmar({ titulo: 'T', mensaje: 'M' });
    servicio.actual()!.responder(false);
    expect(await no).toBe(false);
  });

  it('una confirmación nueva cancela la anterior pendiente', async () => {
    const servicio = TestBed.inject(ConfirmacionService);
    const primera = servicio.confirmar({ titulo: 'A', mensaje: 'M' });
    const segunda = servicio.confirmar({ titulo: 'B', mensaje: 'M' });
    expect(await primera).toBe(false);
    servicio.actual()!.responder(true);
    expect(await segunda).toBe(true);
  });
});

describe('ConfirmacionHost', () => {
  it('muestra la solicitud y responde desde los botones', async () => {
    const fixture = TestBed.createComponent(ConfirmacionHost);
    const servicio = TestBed.inject(ConfirmacionService);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-modal')).toBeNull();

    const promesa = servicio.confirmar({
      titulo: '¿Eliminar?',
      mensaje: 'Sin vuelta atrás',
      textoConfirmar: 'Sí, eliminar',
      peligro: true,
    });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Sin vuelta atrás');
    const botones = el.querySelectorAll<HTMLButtonElement>('.modal__pie button');
    expect(botones[1].textContent).toContain('Sí, eliminar');
    expect(botones[1].classList.contains('btn--peligro')).toBe(true);
    botones[1].click();
    expect(await promesa).toBe(true);
  });
});
