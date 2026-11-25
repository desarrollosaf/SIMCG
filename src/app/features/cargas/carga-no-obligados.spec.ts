import { TestBed } from '@angular/core/testing';
import Swal from 'sweetalert2';
import { of } from 'rxjs';
import { CargasService, PrevisualizacionNoObligados } from '../../core/services/cargas.service';
import { ToastService } from '../../core/services/toast.service';
import { CargaNoObligados } from './carga-no-obligados';

const fila = (renglon: number, estado: 'aplicar' | 'ya_no_obligado' | 'error') => ({
  renglon,
  curp: 'C',
  nombre: 'N',
  tipoMovimiento: 'Inicial',
  fechaMovimiento: '01/01/2025',
  estado,
  errores: estado === 'error' ? ['mal'] : [],
});

const vista: PrevisualizacionNoObligados = {
  total: 3,
  aplicables: 1,
  omitidos: 2,
  filas: [fila(2, 'aplicar'), fila(3, 'ya_no_obligado'), fila(4, 'error')],
};

describe('CargaNoObligados', () => {
  const servicio = {
    descargarLayoutNoObligados: vi.fn(),
    previsualizarNoObligados: vi.fn(),
    confirmarNoObligados: vi.fn(),
  };
  const toast = { success: vi.fn(), error: vi.fn() };
  const archivo = new File(['x'], 'no.csv');

  const crear = (): any => {
    TestBed.overrideComponent(CargaNoObligados, { set: { template: '', imports: [] } });
    return TestBed.createComponent(CargaNoObligados).componentInstance;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: true } as never);
    servicio.previsualizarNoObligados.mockReturnValue(of(vista));
    servicio.confirmarNoObligados.mockReturnValue(
      of({ actualizados: 4, renglonesAplicados: 1, omitidos: 2 }),
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: CargasService, useValue: servicio },
        { provide: ToastService, useValue: toast },
      ],
    });
  });

  it('previsualiza y cuenta errores', () => {
    const c = crear();
    c.alCambiarArchivo(archivo);
    c.previsualizar();
    expect(servicio.previsualizarNoObligados).toHaveBeenCalledWith(archivo);
    expect(c.errores()).toBe(1);
    c.alternarSoloErrores({ target: { checked: true } } as unknown as Event);
    expect(c.filasVisibles().length).toBe(1);
  });

  it('confirma con el mismo archivo y reinicia', async () => {
    const c = crear();
    c.alCambiarArchivo(archivo);
    c.previsualizar();
    c.confirmar();
    await vi.waitFor(() => expect(servicio.confirmarNoObligados).toHaveBeenCalledWith(archivo));
    expect(toast.success).toHaveBeenCalled();
    expect(c.vista()).toBeNull();
    expect(c.archivo()).toBeNull();
  });

  it('no confirma sin renglones aplicables', () => {
    servicio.previsualizarNoObligados.mockReturnValue(
      of({ total: 1, aplicables: 0, omitidos: 1, filas: [] }),
    );
    const c = crear();
    c.alCambiarArchivo(archivo);
    c.previsualizar();
    c.confirmar();
    expect(servicio.confirmarNoObligados).not.toHaveBeenCalled();
  });
});
