import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ServidoresService } from '../../../core/services/servidores.service';
import { ToastService } from '../../../core/services/toast.service';
import { BajaServidor, minimoSinEspacios } from './baja-servidor';

describe('BajaServidor', () => {
  const servicio = { baja: vi.fn() };
  const toast = { success: vi.fn(), errorHttp: vi.fn() };
  const fila = { id: 9, nombre: 'ANA', curp: null, dependencia: null, direccion: null };

  const crear = () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ServidoresService, useValue: servicio },
        { provide: ToastService, useValue: toast },
      ],
    });
    const fixture = TestBed.createComponent(BajaServidor);
    fixture.componentRef.setInput('servidor', fila);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => vi.clearAllMocks());

  it('valida el motivo: requerido, mínimo 5 (sin espacios de los extremos) y máximo 500', () => {
    const c: any = crear().componentInstance;
    const motivo = c.form.controls.motivo;
    expect(motivo.valid).toBe(false);
    motivo.setValue('  ab  ');
    expect(motivo.errors?.['minlength']).toBeTruthy();
    motivo.setValue('x'.repeat(501));
    expect(motivo.errors?.['maxlength']).toBeTruthy();
    motivo.setValue('Renuncia');
    expect(motivo.valid).toBe(true);
    expect(minimoSinEspacios(5)({ value: '' } as any)).toBeNull();
  });

  it('no envía si es inválido', () => {
    const fixture = crear();
    (fixture.componentInstance as any).confirmar();
    expect(servicio.baja).not.toHaveBeenCalled();
  });

  it('da de baja con el motivo recortado, avisa y emite completada', () => {
    servicio.baja.mockReturnValue(of({ mensaje: 'ok' }));
    const fixture = crear();
    const c: any = fixture.componentInstance;
    const completada = vi.fn();
    c.completada.subscribe(completada);
    c.form.controls.motivo.setValue('  Renuncia voluntaria ');
    c.confirmar();
    expect(servicio.baja).toHaveBeenCalledWith(9, 'Renuncia voluntaria');
    expect(toast.success).toHaveBeenCalled();
    expect(completada).toHaveBeenCalled();
  });

  it('si falla, avisa y no emite completada', () => {
    servicio.baja.mockReturnValue(throwError(() => ({ status: 500 })));
    const c: any = crear().componentInstance;
    const completada = vi.fn();
    c.completada.subscribe(completada);
    c.form.controls.motivo.setValue('Renuncia voluntaria');
    c.confirmar();
    expect(toast.errorHttp).toHaveBeenCalled();
    expect(completada).not.toHaveBeenCalled();
    expect(c.guardando()).toBe(false);
  });
});
