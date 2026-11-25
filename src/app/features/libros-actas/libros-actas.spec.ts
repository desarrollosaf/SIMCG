import { TestBed } from '@angular/core/testing';
import Swal from 'sweetalert2';
import { of } from 'rxjs';
import { ActaCierre, LibrosService } from '../../core/services/libros.service';
import { ToastService } from '../../core/services/toast.service';
import { LibrosActas } from './libros-actas';

const resumenTipo = (total: number) => ({ total, fiscal: 1, aclaraciones: 2 });
const acta = (tipo: 'inicial' | 'modificacion' | 'conclusion', tieneActa = false): ActaCierre => ({
  tipo,
  tipoMovimientoId: 1,
  id: tieneActa ? 5 : null,
  anio: 2025,
  tieneActa,
  nombreActa: tieneActa ? 'a.pdf' : null,
  tieneSoporte: false,
  actualizado: null,
});

describe('LibrosActas', () => {
  const servicio = {
    anios: vi.fn(),
    resumen: vi.fn(),
    declaraciones: vi.fn(),
    actas: vi.fn(),
    guardarActa: vi.fn(),
    descargarArchivo: vi.fn(),
  };
  const toast = { success: vi.fn(), error: vi.fn() };

  const configurar = () =>
    TestBed.configureTestingModule({
      providers: [
        { provide: LibrosService, useValue: servicio },
        { provide: ToastService, useValue: toast },
      ],
    });

  const crear = (): any => {
    TestBed.overrideComponent(LibrosActas, { set: { template: '', imports: [] } });
    return TestBed.createComponent(LibrosActas).componentInstance;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: true } as never);
    servicio.anios.mockReturnValue(of([2026, 2025, 2024]));
    servicio.resumen.mockReturnValue(
      of({
        anio: 2026,
        inicial: resumenTipo(5),
        modificacion: resumenTipo(6),
        conclusion: resumenTipo(7),
      }),
    );
    servicio.declaraciones.mockReturnValue(of({ total: 1, filas: [] }));
    servicio.actas.mockReturnValue(of([acta('inicial', true), acta('modificacion')]));
    servicio.guardarActa.mockReturnValue(of(acta('modificacion', true)));
    configurar();
  });

  afterEach(() => vi.useRealTimers());

  it('elige el año actual si existe', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2025, 5, 1));
    expect(crear().anio()).toBe(2025);
  });

  it('elige el más reciente si el año actual no está', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2030, 5, 1));
    expect(crear().anio()).toBe(2026);
  });

  it('carga resumen y declaraciones al iniciar', () => {
    const c = crear();
    expect(servicio.resumen).toHaveBeenCalledWith(c.anio());
    expect(servicio.declaraciones).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'inicial', inicio: 0, limite: 10 }),
    );
    expect(c.resumenActual().total).toBe(5);
  });

  it('cambiar de pestaña recarga declaraciones desde la primera página', () => {
    const c = crear();
    servicio.declaraciones.mockClear();
    c.seleccionarTipo('conclusion');
    expect(servicio.declaraciones).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'conclusion', inicio: 0 }),
    );
    expect(c.resumenActual().total).toBe(7);
  });

  it('cambiar de año recarga resumen y declaraciones', () => {
    const c = crear();
    servicio.resumen.mockClear();
    servicio.declaraciones.mockClear();
    c.cambiarAnio({ target: { value: '2024' } } as unknown as Event);
    expect(c.anio()).toBe(2024);
    expect(servicio.resumen).toHaveBeenCalledWith(2024);
    expect(servicio.declaraciones).toHaveBeenCalledWith(expect.objectContaining({ anio: 2024 }));
  });

  it('la búsqueda espera el debounce', () => {
    vi.useFakeTimers();
    const c = crear();
    servicio.declaraciones.mockClear();
    c.alEscribir({ target: { value: ' ana ' } } as unknown as Event);
    expect(servicio.declaraciones).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    expect(servicio.declaraciones).toHaveBeenCalledWith(expect.objectContaining({ buscar: 'ana' }));
  });

  it('guarda un acta nueva y actualiza la fila', async () => {
    const c = crear();
    c.abrirPanel();
    const archivo = new File(['x'], 'nueva.pdf');
    c.elegirArchivoActa('modificacion', archivo);
    await c.guardarActa(c.actas()[1]);
    expect(servicio.guardarActa).toHaveBeenCalledWith(archivo, c.anio(), 'modificacion');
    expect(c.actas()[1].tieneActa).toBe(true);
    expect(c.archivosActa().modificacion).toBeNull();
    expect(toast.success).toHaveBeenCalled();
  });

  it('no guarda sin archivo seleccionado', async () => {
    const c = crear();
    c.abrirPanel();
    await c.guardarActa(c.actas()[1]);
    expect(servicio.guardarActa).not.toHaveBeenCalled();
  });
});
