import { TestBed } from '@angular/core/testing';
import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { FilaReporte, ReportesService } from '../../../core/services/reportes.service';
import { ToastService } from '../../../core/services/toast.service';
import { ReportesOmisos } from './omisos';

/** Evita descargas reales: la URL temporal es falsa y el clic del enlace se registra. */
function espiarDescarga() {
  return vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:prueba');
  URL.revokeObjectURL = vi.fn();
});

const fila = (id: number, extra: Partial<FilaReporte> = {}): FilaReporte => ({
  id,
  servidorId: id * 10,
  nombre: 'Ana',
  primerApellido: 'Ruiz',
  segundoApellido: 'Gómez',
  curp: 'RUGA800101MMCXXX01',
  cargo: 'Jefa',
  dependencia: 'Dep',
  direccion: 'Dir',
  departamento: 'Depto',
  tipoMovimientoId: 1,
  tipoMovimiento: 'INGRESO',
  fechaDeclaracion: '2026-01-15',
  fechaEnvio: null,
  estatus: 'OMISO',
  ...extra,
});

describe('ReportesOmisos', () => {
  const servicio = { omisos: vi.fn(), excelCorreos: vi.fn() };
  const toast = { success: vi.fn(), error: vi.fn(), errorHttp: vi.fn() };

  const crear = (): any => {
    TestBed.overrideComponent(ReportesOmisos, { set: { template: '', imports: [] } });
    return TestBed.createComponent(ReportesOmisos).componentInstance;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: ReportesService, useValue: servicio },
        { provide: ToastService, useValue: toast },
      ],
    });
  });

  it('no busca sin fechas y avisa con el mensaje del sistema anterior', () => {
    const c = crear();
    c.buscar();
    expect(servicio.omisos).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Favor de llenar los campos de fecha');
  });

  it('busca por rango de fechas y guarda las filas', () => {
    servicio.omisos.mockReturnValue(of([fila(1), fila(2, { estatus: 'ENVIO EXTEMPORANEO' })]));
    const c = crear();
    c.fechaInicio.set('2026-01-01');
    c.fechaFin.set('2026-06-30');
    c.buscar();
    expect(servicio.omisos).toHaveBeenCalledWith('2026-01-01', '2026-06-30');
    expect(c.filas().length).toBe(2);
    expect(c.yaBusco()).toBe(true);
    expect(c.cargando()).toBe(false);
  });

  it('muestra el error del servidor si la consulta falla', () => {
    const error = { status: 500 };
    servicio.omisos.mockReturnValue(throwError(() => error));
    const c = crear();
    c.fechaInicio.set('2026-01-01');
    c.fechaFin.set('2026-06-30');
    c.buscar();
    expect(c.conError()).toBe(true);
    expect(toast.errorHttp).toHaveBeenCalledWith(error, expect.any(String));
  });

  it('sin resultados deja la lista vacía (se muestra «Sin registros»)', () => {
    servicio.omisos.mockReturnValue(of([]));
    const c = crear();
    c.fechaInicio.set('2026-01-01');
    c.fechaFin.set('2026-06-30');
    c.buscar();
    expect(c.yaBusco()).toBe(true);
    expect(c.filas()).toEqual([]);
  });

  it('exporta el Excel de REMISION con las fechas y lo descarga', () => {
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
    const c = crear();
    c.fechaInicio.set('2026-01-01');
    c.fechaFin.set('2026-06-30');
    c.exportar();
    expect(servicio.excelCorreos).toHaveBeenCalledWith('REMISION', '2026-01-01', '2026-06-30');
    expect(descargar).toHaveBeenCalledTimes(1);
    expect(descargar.mock.contexts[0]).toBeInstanceOf(HTMLAnchorElement);
    expect((descargar.mock.contexts[0] as HTMLAnchorElement).download).toBe('correo.xlsx');
    expect(c.exportando()).toBe(false);
  });

  it('exportar sin fechas avisa y no consulta', () => {
    const c = crear();
    c.exportar();
    expect(servicio.excelCorreos).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Favor de llenar los campos de fecha');
  });

  it('filtra, ordena y pagina en el navegador', () => {
    servicio.omisos.mockReturnValue(
      of(Array.from({ length: 25 }, (_, i) => fila(i + 1, { nombre: `N${String(i).padStart(2, '0')}` }))),
    );
    const c = crear();
    c.fechaInicio.set('2026-01-01');
    c.fechaFin.set('2026-06-30');
    c.buscar();
    expect(c.total()).toBe(25);
    expect(c.filasPagina().length).toBe(10);
    c.pagina.set(2);
    expect(c.filasPagina().length).toBe(5);
    c.alEscribir({ target: { value: 'N07' } } as unknown as Event);
    expect(c.total()).toBe(1);
    expect(c.pagina()).toBe(0);
    c.cambiarLimite(50);
    expect(c.limite()).toBe(50);
  });

  it('el botón de oficio abre el modal con la fila elegida', () => {
    const c = crear();
    const f = fila(7);
    c.abrirOficio(f);
    expect(c.oficioFila()).toBe(f);
  });

  it('las columnas son las del sistema anterior, en orden', () => {
    const c = crear();
    expect(c.columnas.map((x: { headerName: string }) => x.headerName)).toEqual([
      'NOMBRE',
      'CURP',
      'CARGO',
      'DEPENDENCIA',
      'T. DE MOVIMIENTO',
      'F. DE MOVIMIENTO',
      'ENVÍO',
      'ESTADO DEL SP',
      'OFICIO DE REMISIÓN (OMISO)',
    ]);
  });
});
