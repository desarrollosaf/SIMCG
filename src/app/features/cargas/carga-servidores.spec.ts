import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import Swal from 'sweetalert2';
import { of, throwError } from 'rxjs';
import { CargasService, PrevisualizacionServidores } from '../../core/services/cargas.service';
import { ToastService } from '../../core/services/toast.service';
import { CargaServidores } from './carga-servidores';

const vista: PrevisualizacionServidores = {
  total: 3,
  validas: 2,
  conErrores: 1,
  filas: [
    { renglon: 2, curp: 'A', nombre: 'Ana', errores: [] },
    { renglon: 3, curp: 'B', nombre: 'Beto', errores: ['CURP inválida'] },
    { renglon: 4, curp: 'C', nombre: 'Cira', errores: [] },
  ],
};

describe('CargaServidores', () => {
  const servicio = {
    descargarLayoutServidores: vi.fn(),
    previsualizarServidores: vi.fn(),
    confirmarServidores: vi.fn(),
  };
  const toast = { success: vi.fn(), error: vi.fn() };
  const archivo = new File(['x'], 'datos.csv');

  // Las propiedades protegidas se leen vía any: el template está vacío en estas pruebas.
  const crear = (): any => {
    TestBed.overrideComponent(CargaServidores, { set: { template: '', imports: [] } });
    return TestBed.createComponent(CargaServidores).componentInstance;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Swal, 'fire').mockResolvedValue({ isConfirmed: true } as never);
    servicio.previsualizarServidores.mockReturnValue(of(vista));
    servicio.confirmarServidores.mockReturnValue(of({ insertados: 2, omitidos: 1 }));
    TestBed.configureTestingModule({
      providers: [
        { provide: CargasService, useValue: servicio },
        { provide: ToastService, useValue: toast },
      ],
    });
  });

  it('no previsualiza sin archivo', () => {
    const c = crear();
    c.previsualizar();
    expect(servicio.previsualizarServidores).not.toHaveBeenCalled();
  });

  it('previsualiza y filtra solo con errores', () => {
    const c = crear();
    c.alCambiarArchivo(archivo);
    c.previsualizar();
    expect(servicio.previsualizarServidores).toHaveBeenCalledWith(archivo);
    expect(c.filasVisibles().length).toBe(3);
    c.alternarSoloErrores({ target: { checked: true } } as unknown as Event);
    expect(c.filasVisibles().map((f: { renglon: number }) => f.renglon)).toEqual([3]);
  });

  it('cambiar el archivo limpia la previsualización', () => {
    const c = crear();
    c.alCambiarArchivo(archivo);
    c.previsualizar();
    c.alCambiarArchivo(new File(['y'], 'otro.csv'));
    expect(c.vista()).toBeNull();
  });

  it('confirma con el mismo archivo, avisa y reinicia', async () => {
    const c = crear();
    c.alCambiarArchivo(archivo);
    c.previsualizar();
    c.confirmar();
    await vi.waitFor(() => expect(servicio.confirmarServidores).toHaveBeenCalledWith(archivo));
    expect(toast.success).toHaveBeenCalledWith('Se cargaron 2 servidores (1 omitidos).');
    expect(c.archivo()).toBeNull();
    expect(c.vista()).toBeNull();
    expect(c.cargando()).toBe(false);
  });

  it('no confirma si no hay renglones válidos', () => {
    servicio.previsualizarServidores.mockReturnValue(
      of({ total: 1, validas: 0, conErrores: 1, filas: [] }),
    );
    const c = crear();
    c.alCambiarArchivo(archivo);
    c.previsualizar();
    c.confirmar();
    expect(servicio.confirmarServidores).not.toHaveBeenCalled();
  });

  it('muestra el mensaje del backend (arreglo) al fallar la previsualización', () => {
    servicio.previsualizarServidores.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: { message: ['a', 'b'] } })),
    );
    const c = crear();
    c.alCambiarArchivo(archivo);
    c.previsualizar();
    expect(toast.error).toHaveBeenCalledWith('a b');
    expect(c.cargando()).toBe(false);
  });

  it('indica volver a previsualizar ante un 409', async () => {
    servicio.confirmarServidores.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409 })),
    );
    const c = crear();
    c.alCambiarArchivo(archivo);
    c.previsualizar();
    c.confirmar();
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error.mock.calls[0][0]).toContain('previsualizar');
  });
});
