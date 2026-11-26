import { TestBed } from '@angular/core/testing';
import { ConfirmarCambios } from './confirmar-cambios';

const cambios = [
  {
    campo: 'cargo',
    etiqueta: 'Nombre del empleo, cargo o comisión',
    antes: 'JEFA',
    despues: 'DIRECTORA',
  },
];

describe('ConfirmarCambios', () => {
  const crear = () => {
    const fixture = TestBed.createComponent(ConfirmarCambios);
    fixture.componentRef.setInput('cambios', cambios);
    fixture.detectChanges();
    return fixture;
  };

  it('muestra el aviso, los cambios (antes y después) y el motivo obligatorio', () => {
    const el: HTMLElement = crear().nativeElement;
    expect(el.querySelector('.modal__titulo')?.textContent).toContain(
      '¿Está seguro que desea modificar la información?',
    );
    expect(el.querySelector('.modal__subtitulo')?.textContent).toContain(
      'Se quedarán registrados los cambios que realices en el sistema.',
    );
    expect(el.querySelector('.cambio__antes')?.textContent).toContain('JEFA');
    expect(el.querySelector('.cambio__despues')?.textContent).toContain('DIRECTORA');
    expect(el.querySelector('label[for="motivo"]')?.textContent).toContain('Motivo del cambio *');
  });

  it('sin motivo no confirma', () => {
    const fixture = crear();
    const confirmar = vi.fn();
    fixture.componentInstance.confirmar.subscribe(confirmar);
    fixture.componentInstance.aceptar();
    fixture.detectChanges();
    expect(confirmar).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.error')).toBeTruthy();
  });

  it('un motivo de solo espacios o muy corto tampoco confirma', () => {
    const fixture = crear();
    const confirmar = vi.fn();
    fixture.componentInstance.confirmar.subscribe(confirmar);
    fixture.componentInstance['form'].controls.motivo.setValue('      ');
    fixture.componentInstance.aceptar();
    fixture.componentInstance['form'].controls.motivo.setValue('abc');
    fixture.componentInstance.aceptar();
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('con motivo emite el texto recortado', () => {
    const fixture = crear();
    const confirmar = vi.fn();
    fixture.componentInstance.confirmar.subscribe(confirmar);
    fixture.componentInstance['form'].controls.motivo.setValue('  CORRECCION DE CARGO ');
    fixture.componentInstance.aceptar();
    expect(confirmar).toHaveBeenCalledWith('CORRECCION DE CARGO');
  });

  it('Cancelar y la X emiten cancelar', () => {
    const fixture = crear();
    const cancelar = vi.fn();
    fixture.componentInstance.cancelar.subscribe(cancelar);
    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('.modal__pie .btn--outline') as HTMLElement).click();
    (el.querySelector('.modal__cerrar') as HTMLElement).click();
    expect(cancelar).toHaveBeenCalledTimes(2);
  });
});
