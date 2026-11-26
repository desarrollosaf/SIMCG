import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Validators } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { CatalogosService } from '../../../core/services/catalogos.service';
import { ServidoresService } from '../../../core/services/servidores.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmacionService } from '../../../shared/confirmacion/confirmacion.service';
import { ServidoresRefresco } from '../servidores-refresco';
import { ServidorForm } from './servidor-form';

const detalle = {
  id: 7,
  nombre: 'ANA',
  primerApellido: 'LOPEZ',
  segundoApellido: null,
  rfc: 'LOPA800101',
  homoclave: 'AB1',
  curp: 'LOPA800101MDFPNN01',
  cargo: 'JEFA',
  nivelCargo: '25-3',
  cveIssemym: '1234567',
  tipoDependenciaId: 1,
  tipoDireccionId: null,
  tipoDepartamentoId: null,
  honorarios: 2,
  fechaInicio: '2020-01-01',
  movimientoInicial: { tipoMovimientoId: 1, tipo: 'INGRESO', fecha: '2020-01-15' },
  presentaVersionLarga: false,
  puedeVersionLarga: true,
  email: null,
};

describe('ServidorForm', () => {
  const servicio = { detalle: vi.fn(), crear: vi.fn(), actualizar: vi.fn(), versionLarga: vi.fn() };
  const catalogos = {
    dependencias: vi.fn(),
    respuestas: vi.fn(),
    tiposMovimiento: vi.fn(),
    direcciones: vi.fn(),
    departamentos: vi.fn(),
  };
  const toast = { success: vi.fn(), info: vi.fn(), errorHttp: vi.fn() };
  const router = { navigate: vi.fn().mockResolvedValue(true) };
  const confirmacion = { confirmar: vi.fn() };
  let refresco: ServidoresRefresco;

  const crear = (id?: string) => {
    TestBed.configureTestingModule({
      providers: [
        ServidoresRefresco,
        { provide: ServidoresService, useValue: servicio },
        { provide: CatalogosService, useValue: catalogos },
        { provide: ToastService, useValue: toast },
        { provide: Router, useValue: router },
        { provide: ConfirmacionService, useValue: confirmacion },
      ],
    });
    refresco = TestBed.inject(ServidoresRefresco);
    vi.spyOn(refresco, 'notificar');
    const fixture = TestBed.createComponent(ServidorForm);
    if (id) fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    servicio.detalle.mockReturnValue(of(detalle));
    servicio.crear.mockReturnValue(of(detalle));
    servicio.actualizar.mockReturnValue(of(detalle));
    catalogos.dependencias.mockReturnValue(of([{ id: 1, nombre: 'DEP' }]));
    catalogos.respuestas.mockReturnValue(
      of([
        { id: 1, respuesta: 'SI' },
        { id: 2, respuesta: 'NO' },
      ]),
    );
    catalogos.tiposMovimiento.mockReturnValue(of([{ id: 1, valor: 'INICIO' }]));
    catalogos.direcciones.mockReturnValue(of([]));
    catalogos.departamentos.mockReturnValue(of([]));
  });

  it('alta: título de alta, movimiento inicial obligatorio y no consulta el detalle', () => {
    const fixture = crear();
    const c: any = fixture.componentInstance;
    expect(fixture.nativeElement.querySelector('.modal__titulo').textContent).toContain(
      'Nuevo servidor público',
    );
    expect(c.esEdicion()).toBe(false);
    expect(servicio.detalle).not.toHaveBeenCalled();
    expect(c.form.controls.tipoMovimientoId.valid).toBe(false);
    expect(catalogos.tiposMovimiento).toHaveBeenCalled();
  });

  it('edición: carga el detalle, muestra el nombre y deja el formulario limpio', () => {
    const fixture = crear('7');
    const c: any = fixture.componentInstance;
    expect(servicio.detalle).toHaveBeenCalledWith(7);
    expect(fixture.nativeElement.querySelector('.modal__titulo').textContent).toContain(
      'Editar servidor público',
    );
    expect(fixture.nativeElement.querySelector('.modal__subtitulo').textContent).toContain(
      'ANA LOPEZ',
    );
    expect(c.form.controls.rfc.value).toBe('LOPA800101');
    expect(c.form.dirty).toBe(false);
    expect(catalogos.tiposMovimiento).not.toHaveBeenCalled();
  });

  it('con cambios sin guardar pide confirmar antes de salir; sin cambios sale directo', async () => {
    const c: any = crear('7').componentInstance;
    expect(c.puedeSalir()).toBe(true);
    expect(confirmacion.confirmar).not.toHaveBeenCalled();

    c.form.controls.cargo.markAsDirty();
    confirmacion.confirmar.mockResolvedValue(false);
    expect(await c.puedeSalir()).toBe(false);
    expect(confirmacion.confirmar).toHaveBeenCalledWith(
      expect.objectContaining({ titulo: '¿Descartar cambios?', peligro: true }),
    );
    confirmacion.confirmar.mockResolvedValue(true);
    expect(await c.puedeSalir()).toBe(true);
  });

  it('cerrar vuelve a la lista conservando los query params', () => {
    (crear().componentInstance as any).cerrar();
    expect(router.navigate).toHaveBeenCalledWith(['/servidores'], {
      queryParamsHandling: 'preserve',
    });
  });

  it('no guarda si es inválido', async () => {
    const c: any = crear().componentInstance;
    await c.guardar();
    expect(servicio.crear).not.toHaveBeenCalled();
    expect(c.intentado()).toBe(true);
  });

  it('guarda el alta: avisa a la lista, muestra toast y cierra el modal', async () => {
    const c: any = crear().componentInstance;
    c.form.patchValue({
      tipoMovimientoId: 1,
      fechaDeclaracion: '2026-01-01',
      fechaInicio: '2026-01-01',
      rfc: 'ABCD010101',
      homoclave: 'XX1',
      curp: 'ABCD010101HDFXYZ01',
      nombre: 'LUIS',
      primerApellido: 'PEREZ',
      cargo: 'ANALISTA',
      nivelCargo: '25-3',
      cveIssemym: '7654321',
      tipoDependenciaId: 1,
      honorarios: 1,
    });
    expect(c.form.valid).toBe(true);
    await c.guardar();

    expect(servicio.crear).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'LUIS', tipoMovimientoId: 1, honorarios: 1 }),
    );
    expect(toast.success).toHaveBeenCalledWith('Servidor público registrado.');
    expect(refresco.notificar).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/servidores'], {
      queryParamsHandling: 'preserve',
    });
    // Tras guardar ya no pregunta por cambios.
    expect(c.form.dirty).toBe(false);
  });

  it('edición: muestra tipo y fechas del movimiento inicial en solo lectura', () => {
    const el: HTMLElement = crear('7').nativeElement;
    const tipo = el.querySelector('#tipoMovimientoLectura') as HTMLInputElement;
    expect(tipo.disabled).toBe(true);
    expect(tipo.value).toBe('INGRESO');
    expect((el.querySelector('#fechaMovimientoLectura') as HTMLInputElement).value).toBe(
      '2020-01-15',
    );
    expect((el.querySelector('#fechaInicioLectura') as HTMLInputElement).disabled).toBe(true);
  });

  it('el pie solo tiene Guardar (se cierra con la X del encabezado)', () => {
    const el: HTMLElement = crear('7').nativeElement;
    const botones = Array.from(el.querySelectorAll('.modal__pie button')).map((b) =>
      b.textContent?.trim(),
    );
    expect(botones).toEqual(['Guardar']);
  });

  it('edición sin cambios: avisa y no abre la confirmación ni guarda', () => {
    const c: any = crear('7').componentInstance;
    c.guardar();
    expect(toast.info).toHaveBeenCalledWith('No hay cambios que guardar.');
    expect(c.cambiosPorConfirmar()).toBeNull();
    expect(servicio.actualizar).not.toHaveBeenCalled();
  });

  it('edición con cambios: abre la confirmación con antes y después, sin guardar todavía', () => {
    const fixture = crear('7');
    const c: any = fixture.componentInstance;
    c.form.patchValue({ cargo: 'DIRECTORA', honorarios: 1 });
    c.guardar();
    fixture.detectChanges();

    expect(servicio.actualizar).not.toHaveBeenCalled();
    expect(c.cambiosPorConfirmar()).toEqual([
      {
        campo: 'cargo',
        etiqueta: 'Nombre del empleo, cargo o comisión',
        antes: 'JEFA',
        despues: 'DIRECTORA',
      },
      {
        campo: 'honorarios',
        etiqueta: '¿Está contratado por honorarios?',
        antes: 'NO',
        despues: 'SI',
      },
    ]);
    expect(fixture.nativeElement.querySelector('app-confirmar-cambios')).toBeTruthy();
  });

  it('cancelar la confirmación vuelve al formulario sin guardar', () => {
    const fixture = crear('7');
    const c: any = fixture.componentInstance;
    c.form.patchValue({ cargo: 'DIRECTORA' });
    c.guardar();
    fixture.detectChanges();

    c.cancelarConfirmacion();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-confirmar-cambios')).toBeNull();
    expect(servicio.actualizar).not.toHaveBeenCalled();
    expect(c.form.controls.cargo.value).toBe('DIRECTORA');
  });

  it('confirmar con motivo guarda con actualizar, avisa a la lista y cierra', () => {
    const c: any = crear('7').componentInstance;
    c.form.patchValue({ cargo: 'DIRECTORA' });
    c.guardar();
    c.confirmarCambios('CORRECCION DE CARGO');

    expect(servicio.actualizar).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        rfc: 'LOPA800101',
        cargo: 'DIRECTORA',
        motivo: 'CORRECCION DE CARGO',
      }),
    );
    expect(servicio.actualizar.mock.calls[0][1]).not.toHaveProperty('email');
    expect(toast.success).toHaveBeenCalledWith('Servidor público actualizado.');
    expect(refresco.notificar).toHaveBeenCalled();
    expect(c.cambiosPorConfirmar()).toBeNull();
  });

  it('si el guardado falla cierra la confirmación y deja el formulario para corregir', () => {
    servicio.actualizar.mockReturnValue(throwError(() => new Error('409')));
    const c: any = crear('7').componentInstance;
    c.form.patchValue({ cargo: 'DIRECTORA' });
    c.guardar();
    c.confirmarCambios('CORRECCION');

    expect(toast.errorHttp).toHaveBeenCalled();
    expect(c.cambiosPorConfirmar()).toBeNull();
    expect(c.guardando()).toBe(false);
  });

  it('el correo es de solo lectura hasta confirmar que se quiere editar', async () => {
    servicio.detalle.mockReturnValue(of({ ...detalle, email: 'ana@x.com' }));
    const fixture = crear('7');
    const c: any = fixture.componentInstance;
    const input = () => fixture.nativeElement.querySelector('#email') as HTMLInputElement;
    expect(input().readOnly).toBe(true);

    confirmacion.confirmar.mockResolvedValue(false);
    await c.editarCorreo();
    expect(confirmacion.confirmar).toHaveBeenCalledWith(
      expect.objectContaining({
        titulo: '¿Está seguro que desea modificar la información?',
        mensaje: 'Se quedarán registrados los cambios que realices en el sistema.',
      }),
    );
    fixture.detectChanges();
    expect(input().readOnly).toBe(true);

    confirmacion.confirmar.mockResolvedValue(true);
    await c.editarCorreo();
    fixture.detectChanges();
    expect(input().readOnly).toBe(false);
  });

  it('un cambio de correo entra a la lista y se envía junto con el motivo', async () => {
    servicio.detalle.mockReturnValue(of({ ...detalle, email: 'ana@x.com' }));
    const c: any = crear('7').componentInstance;
    confirmacion.confirmar.mockResolvedValue(true);
    await c.editarCorreo();
    c.form.patchValue({ email: 'nuevo@x.com' });
    c.guardar();

    expect(c.cambiosPorConfirmar()).toEqual([
      { campo: 'email', etiqueta: 'Correo', antes: 'ana@x.com', despues: 'nuevo@x.com' },
    ]);
    c.confirmarCambios('CAMBIO DE CORREO');
    expect(servicio.actualizar).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ email: 'nuevo@x.com', motivo: 'CAMBIO DE CORREO' }),
    );
  });

  it('pasa a mayúsculas lo que se captura', () => {
    const fixture = crear('7');
    const c: any = fixture.componentInstance;
    const campo = fixture.nativeElement.querySelector('#nombre') as HTMLInputElement;
    campo.value = 'maría';
    c.mayusculas('nombre', { target: campo } as unknown as Event);
    expect(c.form.controls.nombre.value).toBe('MARÍA');
  });

  it('la dirección es obligatoria solo cuando la dependencia tiene direcciones', () => {
    catalogos.direcciones.mockReturnValue(of([{ id: 4, nombre: 'DIR', dependenciaId: 1 }]));
    const c: any = crear('7').componentInstance;
    expect(c.form.controls.tipoDireccionId.hasValidator(Validators.required)).toBe(true);

    catalogos.direcciones.mockReturnValue(of([]));
    c.form.controls.tipoDependenciaId.setValue(2);
    expect(c.form.controls.tipoDireccionId.hasValidator(Validators.required)).toBe(false);
  });
});
