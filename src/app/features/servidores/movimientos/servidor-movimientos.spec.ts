import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { CatalogosService } from '../../../core/services/catalogos.service';
import { Movimiento, ServidoresService } from '../../../core/services/servidores.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmacionService } from '../../../shared/confirmacion/confirmacion.service';
import { EstadoError, EstadoVacio } from '../../../shared/estado/estado';
import { Modal } from '../../../shared/modal/modal';
import { Paginador } from '../../../shared/paginador/paginador';
import { ServidoresRefresco } from '../servidores-refresco';
import { CambiarObligado } from './cambiar-obligado';
import { CeldaPdf } from './celda-pdf';
import {
  ServidorMovimientos,
  columnasVisibles,
  estadoPdf,
  estatusMovimiento,
  puedeVerPdf,
} from './servidor-movimientos';

const movimiento: Movimiento = {
  id: 5,
  tipoMovimientoId: 1,
  tipo: 'INICIO',
  fechaDeclaracion: '2026-01-01',
  obligado: true,
  motivoNoObligadoId: null,
  estado: 'OBLIGADO',
  estatus: 'EN TIEMPO',
  oficioPreventivo: null,
  oficioRemision: null,
  fechaEnvio: null,
  estatusDeclaracion: 'Iniciada',
};

const servicio = {
  detalle: vi.fn(),
  movimientos: vi.fn(),
  movimientosPermitidos: vi.fn(),
  crearMovimiento: vi.fn(),
  cambiarObligado: vi.fn(),
};
const toast = { success: vi.fn(), errorHttp: vi.fn() };
const router = { navigate: vi.fn().mockResolvedValue(true) };
const confirmacion = { confirmar: vi.fn() };
const catalogos = {
  motivosNoObligado: vi.fn(),
  dependencias: vi.fn(),
};

const proveedores = (roles = ['Administrador']) => [
  ServidoresRefresco,
  { provide: ServidoresService, useValue: servicio },
  { provide: ToastService, useValue: toast },
  { provide: Router, useValue: router },
  { provide: ConfirmacionService, useValue: confirmacion },
  { provide: CatalogosService, useValue: catalogos },
  { provide: AuthService, useValue: { currentUser: signal({ roles }) } },
];

beforeEach(() => {
  vi.clearAllMocks();
  servicio.detalle.mockReturnValue(
    of({
      id: 7,
      nombre: 'ANA',
      primerApellido: 'LOPEZ',
      segundoApellido: null,
      curp: 'CURP123',
      tipoDependenciaId: 4,
    }),
  );
  catalogos.dependencias.mockReturnValue(of([{ id: 4, nombre: 'TESORERIA' }]));
  servicio.movimientos.mockReturnValue(of([movimiento]));
  servicio.movimientosPermitidos.mockReturnValue(
    of([
      { id: 3, valor: 'MODIFICACION' },
      { id: 4, valor: 'CONCLUSION' },
    ]),
  );
  servicio.crearMovimiento.mockReturnValue(of({ id: 99 }));
  servicio.cambiarObligado.mockReturnValue(of({ mensaje: 'ok' }));
  catalogos.motivosNoObligado.mockReturnValue(
    of([
      { id: 1, causa: 'POR DEFUNCIÓN' },
      { id: 3, causa: 'OTRO' },
    ]),
  );
});

describe('ServidorMovimientos', () => {
  const crear = (roles?: string[]) => {
    TestBed.configureTestingModule({
      providers: proveedores(roles),
      errorOnUnknownElements: false,
      errorOnUnknownProperties: false,
    });
    // El grid de ag-grid no se monta en estas pruebas.
    TestBed.overrideComponent(ServidorMovimientos, {
      set: {
        imports: [ReactiveFormsModule, Modal, CambiarObligado, EstadoVacio, EstadoError, Paginador],
      },
    });
    const fixture = TestBed.createComponent(ServidorMovimientos);
    fixture.componentRef.setInput('id', '7');
    fixture.detectChanges();
    return fixture;
  };

  it('carga movimientos y muestra nombre, CURP y dependencia en el encabezado', () => {
    const fixture = crear();
    expect(servicio.movimientos).toHaveBeenCalledWith(7);
    expect(fixture.nativeElement.querySelector('.modal__titulo').textContent).toContain(
      'ANA LOPEZ',
    );
    expect(fixture.nativeElement.querySelector('.modal__subtitulo').textContent).toContain(
      'CURP123 · TESORERIA',
    );
  });

  it('muestra las secciones «Registro de nuevo movimiento» e «Histórico de movimientos»', () => {
    const el: HTMLElement = crear().nativeElement;
    const titulos = Array.from(el.querySelectorAll('.seccion__titulo')).map((t) =>
      t.textContent?.trim(),
    );
    expect(titulos).toEqual(['Registro de nuevo movimiento', 'Histórico de movimientos']);
  });

  it('el select del registro tiene el placeholder y los tipos permitidos; el botón dice «Guardar movimiento»', () => {
    const el: HTMLElement = crear().nativeElement;
    const opciones = Array.from(el.querySelectorAll('#tipoMovimientoId option')).map((o) =>
      o.textContent?.trim(),
    );
    expect(opciones).toEqual(['Selecciona una opción', 'MODIFICACION', 'CONCLUSION']);
    expect(el.querySelector('label[for="tipoMovimientoId"]')?.textContent).toContain(
      'Tipo de movimiento',
    );
    expect(el.querySelector('#form-movimiento button')?.textContent?.trim()).toBe(
      'Guardar movimiento',
    );
  });

  it('el modal no tiene pie: solo se cierra con la X del encabezado', () => {
    const el: HTMLElement = crear().nativeElement;
    expect(el.querySelector('.modal__pie')?.children.length ?? 0).toBe(0);
    expect(el.textContent).not.toContain('Cerrar movimientos');
    expect(
      Array.from(el.querySelectorAll('button')).map((b) => b.textContent?.trim()),
    ).not.toContain('Cerrar');
  });

  it('un rol de solo lectura no ve el registro de movimientos', () => {
    const el: HTMLElement = crear(['Consulta']).nativeElement;
    expect(el.querySelector('#form-movimiento')).toBeNull();
    expect(el.textContent).toContain('Histórico de movimientos');
  });

  it('sin elegir tipo no guarda ni pide confirmación', async () => {
    const c: any = crear().componentInstance;
    await c.guardar();
    expect(confirmacion.confirmar).not.toHaveBeenCalled();
    expect(servicio.crearMovimiento).not.toHaveBeenCalled();
  });

  it('si no se confirma no registra el movimiento', async () => {
    const c: any = crear().componentInstance;
    c.form.controls.tipoMovimientoId.setValue(3);
    confirmacion.confirmar.mockResolvedValue(false);
    await c.guardar();
    expect(servicio.crearMovimiento).not.toHaveBeenCalled();
  });

  it('confirmado registra, avisa con toast, recarga y notifica a la lista', async () => {
    const c: any = crear().componentInstance;
    const refresco = TestBed.inject(ServidoresRefresco);
    vi.spyOn(refresco, 'notificar');
    c.form.controls.tipoMovimientoId.setValue(3);
    confirmacion.confirmar.mockResolvedValue(true);

    await c.guardar();

    expect(confirmacion.confirmar).toHaveBeenCalledWith(
      expect.objectContaining({ mensaje: expect.stringContaining('MODIFICACION') }),
    );
    expect(servicio.crearMovimiento).toHaveBeenCalledWith(7, 3);
    expect(toast.success).toHaveBeenCalledWith('Movimiento registrado correctamente');
    expect(servicio.movimientos).toHaveBeenCalledTimes(2);
    expect(servicio.movimientosPermitidos).toHaveBeenCalledTimes(2);
    expect(refresco.notificar).toHaveBeenCalled();
    expect(c.form.controls.tipoMovimientoId.value).toBeNull();
  });

  it('si el registro falla muestra el error y recarga', async () => {
    servicio.crearMovimiento.mockReturnValue(throwError(() => new Error('400')));
    const c: any = crear().componentInstance;
    c.form.controls.tipoMovimientoId.setValue(3);
    confirmacion.confirmar.mockResolvedValue(true);
    await c.guardar();
    expect(toast.errorHttp).toHaveBeenCalled();
    expect(c.guardando()).toBe(false);
    expect(servicio.movimientos).toHaveBeenCalledTimes(2);
  });

  it('la acción de fila es «Cambiar status» y no hay eliminar', () => {
    const c: any = crear().componentInstance;
    expect(c.acciones.map((a: { etiqueta: string }) => a.etiqueta)).toEqual(['Cambiar status']);
    expect(servicio).not.toHaveProperty('eliminarMovimiento');
  });

  it('las columnas siguen el histórico del sistema viejo', () => {
    const c: any = crear().componentInstance;
    const titulos = c.columnas.map((col: { colId: string; headerName: string }) => col.colId);
    expect(titulos).toEqual([
      'movimiento',
      'estado',
      'estadoDeclaracion',
      'oficios',
      'envio',
      'status',
      'pdf',
      'acciones',
    ]);
    const encabezado = (id: string) =>
      c.columnas.find((col: { colId: string }) => col.colId === id).headerName;
    expect(encabezado('movimiento')).toBe('Tipo y fecha de movimiento');
    expect(encabezado('status')).toBe('Status');
  });

  it('cambiar status abre el modal anidado y al guardar recarga y avisa a la lista', () => {
    const fixture = crear();
    const c: any = fixture.componentInstance;
    const refresco = TestBed.inject(ServidoresRefresco);
    vi.spyOn(refresco, 'notificar');

    c.editandoObligado.set(movimiento);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-cambiar-obligado')).toBeTruthy();

    c.alGuardarObligado();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-cambiar-obligado')).toBeNull();
    expect(servicio.movimientos).toHaveBeenCalledTimes(2);
    expect(refresco.notificar).toHaveBeenCalled();
  });

  it('cerrar vuelve a la lista conservando los query params', () => {
    (crear().componentInstance as any).cerrar();
    expect(router.navigate).toHaveBeenCalledWith(['/servidores'], {
      queryParamsHandling: 'preserve',
    });
  });
});

describe('CambiarObligado', () => {
  const crear = (m: Movimiento = movimiento) => {
    TestBed.configureTestingModule({ providers: proveedores() });
    const fixture = TestBed.createComponent(CambiarObligado);
    fixture.componentRef.setInput('movimiento', m);
    fixture.detectChanges();
    return fixture;
  };

  it('se llama «Cambiar status», ofrece OBLIGADO / NO OBLIGADO y solo cierra con la X', () => {
    const el: HTMLElement = crear().nativeElement;
    expect(el.querySelector('.modal__titulo')?.textContent).toContain('Cambiar status');
    const opciones = Array.from(el.querySelectorAll('#status-obligado option')).map((o) =>
      o.textContent?.trim(),
    );
    expect(opciones).toEqual(['OBLIGADO', 'NO OBLIGADO']);
    const botones = Array.from(el.querySelectorAll('.modal__pie button')).map((b) =>
      b.textContent?.trim(),
    );
    expect(botones).toEqual(['Guardar']);
  });

  it('el motivo (del catálogo) solo aparece y es obligatorio con NO OBLIGADO', () => {
    const fixture = crear();
    const c: any = fixture.componentInstance;
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#motivo-no-obligado')).toBeNull();
    expect(c.form.valid).toBe(true);

    c.form.controls.obligado.setValue('no');
    fixture.detectChanges();
    const motivos = Array.from(el.querySelectorAll('#motivo-no-obligado option')).map((o) =>
      o.textContent?.trim(),
    );
    expect(motivos).toEqual(['Selecciona una opción', 'POR DEFUNCIÓN', 'OTRO']);
    expect(c.form.controls.motivoNoObligadoId.valid).toBe(false);
    c.guardar();
    expect(servicio.cambiarObligado).not.toHaveBeenCalled();

    c.form.controls.motivoNoObligadoId.setValue(3);
    expect(c.form.valid).toBe(true);
    c.form.controls.obligado.setValue('si');
    expect(c.form.controls.motivoNoObligadoId.value).toBeNull();
  });

  it('precarga el estado actual del movimiento', () => {
    const c: any = crear({
      ...movimiento,
      obligado: false,
      motivoNoObligadoId: 3,
    }).componentInstance;
    expect(c.form.getRawValue()).toEqual({ obligado: 'no', motivoNoObligadoId: 3 });
  });

  it('guarda como no obligado con motivo, avisa con toast y emite guardado', () => {
    const c: any = crear().componentInstance;
    const guardado = vi.fn();
    c.guardado.subscribe(guardado);
    c.form.patchValue({ obligado: 'no' });
    c.form.patchValue({ motivoNoObligadoId: 3 });
    c.guardar();
    expect(servicio.cambiarObligado).toHaveBeenCalledWith(5, false, 3);
    expect(toast.success).toHaveBeenCalledWith('Declaración guardada correctamente');
    expect(guardado).toHaveBeenCalled();
  });

  it('guarda como obligado sin enviar motivo', () => {
    const c: any = crear({
      ...movimiento,
      obligado: false,
      motivoNoObligadoId: 3,
    }).componentInstance;
    c.form.patchValue({ obligado: 'si' });
    c.guardar();
    expect(servicio.cambiarObligado).toHaveBeenCalledWith(5, true, undefined);
  });
});

describe('PDF de la declaración', () => {
  it('solo Administrador y Consulta pueden verlos', () => {
    expect(puedeVerPdf(['Administrador'])).toBe(true);
    expect(puedeVerPdf(['Consulta'])).toBe(true);
    expect(puedeVerPdf(['Registro'])).toBe(false);
    expect(puedeVerPdf(null)).toBe(false);
  });

  it('sin fecha de envío no hay PDF; con envío depende del rol', () => {
    expect(estadoPdf(movimiento, true)).toBe('sin-envio');
    const enviado = { ...movimiento, fechaEnvio: '2026-02-01' };
    expect(estadoPdf(enviado, true)).toBe('disponible');
    expect(estadoPdf(enviado, false)).toBe('sin-permiso');
  });

  it('la celda muestra los botones deshabilitados con «Próximamente»', () => {
    const fixture = TestBed.createComponent(CeldaPdf);
    fixture.componentInstance.agInit({
      data: { ...movimiento, fechaEnvio: '2026-02-01' },
      estado: () => 'disponible',
    } as never);
    fixture.detectChanges();
    const botones = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    expect(botones.map((b) => b.disabled)).toEqual([true, true]);
    expect(botones.every((b) => b.title.includes('Próximamente'))).toBe(true);
  });

  it('la celda sin envío o sin permiso muestra texto', () => {
    const fixture = TestBed.createComponent(CeldaPdf);
    fixture.componentInstance.agInit({ data: movimiento, estado: () => 'sin-envio' } as never);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('SIN ENVÍO');

    fixture.componentInstance.refresh({ data: movimiento, estado: () => 'sin-permiso' } as never);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('SIN PERMISO');
  });
});

describe('columnasVisibles', () => {
  it('muestra todas las columnas en anchos grandes', () => {
    expect(columnasVisibles(1060)).toEqual([
      'movimiento',
      'estado',
      'estadoDeclaracion',
      'oficios',
      'envio',
      'status',
      'pdf',
    ]);
  });

  it('quita columnas secundarias conforme se angosta', () => {
    expect(columnasVisibles(950)).not.toContain('estadoDeclaracion');
    expect(columnasVisibles(950)).toContain('oficios');
    expect(columnasVisibles(760)).not.toContain('oficios');
    expect(columnasVisibles(600)).toEqual(['movimiento', 'estado', 'status']);
  });

  it('en anchos de celular conserva movimiento y estado, sin scroll horizontal', () => {
    expect(columnasVisibles(360)).toEqual(['movimiento', 'estado']);
  });
});

describe('estatusMovimiento', () => {
  it('asigna el tono del chip según el estatus', () => {
    expect(estatusMovimiento('OMISO').tono).toBe('error');
    expect(estatusMovimiento('ENVIO EXTEMPORANEO').tono).toBe('error');
    expect(estatusMovimiento('NO OBLIGADO - POR DEFUNCIÓN').tono).toBe('neutro');
    expect(estatusMovimiento('EN TIEMPO').tono).toBe('ok');
    expect(estatusMovimiento(null)).toEqual({ texto: '', tono: 'ok' });
  });

  it('muestra los textos con acentos', () => {
    expect(estatusMovimiento('ENVIO EXTEMPORANEO').texto).toBe('ENVÍO EXTEMPORÁNEO');
    expect(estatusMovimiento('ENVIO EN TIEMPO').texto).toBe('ENVÍO EN TIEMPO');
    expect(estatusMovimiento('OMISO').texto).toBe('OMISO');
  });
});
