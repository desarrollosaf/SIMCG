import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { FilaReporte, ReportesService } from '../../../core/services/reportes.service';
import { ToastService } from '../../../core/services/toast.service';
import { OficioOmisoModal, folioSinPrefijo } from './oficio-omiso-modal';
import { OficioPreventivoModal } from './oficio-preventivo-modal';
import { ReporteCorreosModal } from './reporte-correos-modal';

/** Evita descargas reales: la URL temporal es falsa y el clic del enlace se registra. */
function espiarDescarga() {
  return vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:prueba');
  URL.revokeObjectURL = vi.fn();
});

const fila: FilaReporte = {
  id: 55,
  servidorId: 7,
  nombre: 'Ana',
  primerApellido: 'Ruiz',
  segundoApellido: null,
  curp: 'X',
  cargo: 'Jefa',
  dependencia: 'Dep',
  direccion: 'Dir',
  departamento: '',
  tipoMovimientoId: 1,
  tipoMovimiento: 'INGRESO',
  fechaDeclaracion: '2026-01-15',
  fechaEnvio: null,
  estatus: 'OMISO',
};

describe('modales de reportes', () => {
  const servicio = {
    oficioPrevioOmiso: vi.fn(),
    oficioPrevioPreventivo: vi.fn(),
    generarOficioOmiso: vi.fn(),
    generarOficioPreventivo: vi.fn(),
    excelCorreos: vi.fn(),
  };
  const toast = { success: vi.fn(), error: vi.fn(), errorHttp: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    servicio.oficioPrevioOmiso.mockReturnValue(of({ noOficio: null }));
    servicio.oficioPrevioPreventivo.mockReturnValue(of({ noOficio: null }));
    TestBed.configureTestingModule({
      providers: [
        { provide: ReportesService, useValue: servicio },
        { provide: ToastService, useValue: toast },
      ],
    });
  });

  const crear = <T>(tipo: Type<T>, entradas: Record<string, unknown> = {}): T => {
    TestBed.overrideComponent(tipo, { set: { template: '', imports: [] } });
    const fixture = TestBed.createComponent(tipo);
    for (const [k, v] of Object.entries(entradas)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  it('folioSinPrefijo deja solo el número', () => {
    expect(folioSinPrefijo('CPL/DSP/MCG/0123')).toBe('0123');
    expect(folioSinPrefijo(' cpl/dsp/mcg/0123 ')).toBe('0123');
    expect(folioSinPrefijo('0123')).toBe('0123');
  });

  describe('OficioOmisoModal', () => {
    it('sin oficio previo deja el folio editable y vacío', () => {
      const c: any = crear(OficioOmisoModal, { fila });
      expect(servicio.oficioPrevioOmiso).toHaveBeenCalledWith(55);
      expect(c.folioBloqueado()).toBe(false);
      expect(c.form.controls.folio.value).toBe('');
    });

    it('con oficio previo precarga solo el número y lo bloquea', () => {
      servicio.oficioPrevioOmiso.mockReturnValue(of({ noOficio: 'CPL/DSP/MCG/0123' }));
      const c: any = crear(OficioOmisoModal, { fila });
      expect(c.form.controls.folio.value).toBe('0123');
      expect(c.folioBloqueado()).toBe(true);
    });

    it('no genera con campos vacíos', () => {
      const c: any = crear(OficioOmisoModal, { fila });
      c.generar();
      expect(servicio.generarOficioOmiso).not.toHaveBeenCalled();
      expect(c.invalido('folioDadp')).toBe(true);
    });

    it('exige los cinco campos y abre el PDF en pestaña nueva', () => {
      const pdf = new Blob(['%PDF']);
      servicio.generarOficioOmiso.mockReturnValue(of(pdf));
      const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
      const c: any = crear(OficioOmisoModal, { fila });
      const cerrado = vi.fn();
      c.cerrar.subscribe(cerrado);
      c.form.patchValue({
        folio: 'CPL/DSP/MCG/0123',
        folioDadp: ' D-45 ',
        fechaOficio: '2026-11-20',
        fechaPadron: '2026-11-15',
        soporte: ' Padrón ',
      });
      c.generar();
      expect(servicio.generarOficioOmiso).toHaveBeenCalledWith({
        declaracionId: 55,
        folio: '0123',
        folioDadp: 'D-45',
        fechaOficio: '2026-11-20',
        fechaPadron: '2026-11-15',
        soporte: 'Padrón',
      });
      expect(abrir).toHaveBeenCalledWith('blob:prueba', '_blank');
      expect(cerrado).toHaveBeenCalled();
    });

    it('si falla muestra el error y no cierra', () => {
      const error = { status: 404 };
      servicio.generarOficioOmiso.mockReturnValue(throwError(() => error));
      const c: any = crear(OficioOmisoModal, { fila });
      const cerrado = vi.fn();
      c.cerrar.subscribe(cerrado);
      c.form.patchValue({
        folio: '1',
        folioDadp: 'D',
        fechaOficio: '2026-11-20',
        fechaPadron: '2026-11-15',
        soporte: 'S',
      });
      c.generar();
      expect(toast.errorHttp).toHaveBeenCalledWith(error, expect.any(String));
      expect(cerrado).not.toHaveBeenCalled();
      expect(c.guardando()).toBe(false);
    });
  });

  describe('OficioPreventivoModal', () => {
    it('con oficio previo precarga el número en solo lectura', () => {
      servicio.oficioPrevioPreventivo.mockReturnValue(of({ noOficio: '0200' }));
      const c: any = crear(OficioPreventivoModal, { fila });
      expect(servicio.oficioPrevioPreventivo).toHaveBeenCalledWith(55);
      expect(c.form.controls.folio.value).toBe('0200');
      expect(c.folioBloqueado()).toBe(true);
    });

    it('pide folio y fecha y abre el PDF', () => {
      const pdf = new Blob(['%PDF']);
      servicio.generarOficioPreventivo.mockReturnValue(of(pdf));
      const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
      const c: any = crear(OficioPreventivoModal, { fila });
      c.generar();
      expect(servicio.generarOficioPreventivo).not.toHaveBeenCalled();
      c.form.patchValue({ folio: '0200', fechaOficio: '2026-11-25' });
      c.generar();
      expect(servicio.generarOficioPreventivo).toHaveBeenCalledWith({
        declaracionId: 55,
        folio: '0200',
        fechaOficio: '2026-11-25',
      });
      expect(abrir).toHaveBeenCalledWith('blob:prueba', '_blank');
    });
  });

  describe('ReporteCorreosModal', () => {
    it('exige las dos fechas', () => {
      const c: any = crear(ReporteCorreosModal);
      c.generar();
      expect(servicio.excelCorreos).not.toHaveBeenCalled();
      expect(c.invalido('fechaInicio')).toBe(true);
    });

    it('descarga el Excel PREVENTIVO con el nombre del servidor', () => {
      const blob = new Blob(['x']);
      servicio.excelCorreos.mockReturnValue(
        of(
          new HttpResponse({
            body: blob,
            headers: new HttpHeaders({ 'Content-Disposition': 'attachment; filename="correo.xlsx"' }),
          }),
        ),
      );
      const descargar = espiarDescarga();
      const c: any = crear(ReporteCorreosModal);
      const cerrado = vi.fn();
      c.cerrar.subscribe(cerrado);
      c.form.patchValue({ fechaInicio: '2026-11-01', fechaFin: '2026-11-30' });
      c.generar();
      expect(servicio.excelCorreos).toHaveBeenCalledWith('PREVENTIVO', '2026-11-01', '2026-11-30');
      expect(descargar).toHaveBeenCalledTimes(1);
    expect(descargar.mock.contexts[0]).toBeInstanceOf(HTMLAnchorElement);
    expect((descargar.mock.contexts[0] as HTMLAnchorElement).download).toBe('correo.xlsx');
      expect(cerrado).toHaveBeenCalled();
    });
  });
});
