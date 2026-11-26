import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { FilaReporte, ReportesService } from '../../../core/services/reportes.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmacionService } from '../../../shared/confirmacion/confirmacion.service';
import { ReportesPreventivos } from './preventivos';

const fila = (id: number): FilaReporte => ({
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
  fechaDeclaracion: '2026-10-15',
  fechaEnvio: null,
  estatus: 'EN TIEMPO',
});

describe('ReportesPreventivos', () => {
  const servicio = { preventivos: vi.fn(), enviarCorreoPreventivo: vi.fn() };
  const toast = { success: vi.fn(), error: vi.fn(), errorHttp: vi.fn() };
  const confirmacion = { confirmar: vi.fn() };

  const crear = (): any => {
    TestBed.overrideComponent(ReportesPreventivos, { set: { template: '', imports: [] } });
    return TestBed.createComponent(ReportesPreventivos).componentInstance;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    servicio.preventivos.mockReturnValue(of([fila(1), fila(2)]));
    confirmacion.confirmar.mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: ReportesService, useValue: servicio },
        { provide: ToastService, useValue: toast },
        { provide: ConfirmacionService, useValue: confirmacion },
      ],
    });
  });

  it('carga los preventivos al abrir', () => {
    const c = crear();
    expect(servicio.preventivos).toHaveBeenCalledTimes(1);
    expect(c.filas().length).toBe(2);
    expect(c.yaCargo()).toBe(true);
    expect(c.cargando()).toBe(false);
  });

  it('si la carga falla marca el error y avisa', () => {
    const error = { status: 500 };
    servicio.preventivos.mockReturnValue(throwError(() => error));
    const c = crear();
    expect(c.conError()).toBe(true);
    expect(toast.errorHttp).toHaveBeenCalledWith(error, expect.any(String));
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
      'OFICIO PREVENTIVO',
      'ENVIO CORREO',
    ]);
  });

  it('envía el correo tras confirmar y muestra el éxito', async () => {
    servicio.enviarCorreoPreventivo.mockReturnValue(of({ ok: true }));
    const c = crear();
    await c.enviarCorreo(fila(1));
    expect(confirmacion.confirmar).toHaveBeenCalledTimes(1);
    expect(servicio.enviarCorreoPreventivo).toHaveBeenCalledWith(1);
    expect(toast.success).toHaveBeenCalledWith('Correo enviado con éxito.');
    expect(c.enviando().size).toBe(0);
  });

  it('si se cancela la confirmación no envía nada', async () => {
    confirmacion.confirmar.mockResolvedValue(false);
    const c = crear();
    await c.enviarCorreo(fila(1));
    expect(servicio.enviarCorreoPreventivo).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('muestra el error del servidor (p. ej. «Usuario no registrado.»)', async () => {
    const error = { status: 422, error: { message: 'Usuario no registrado.' } };
    servicio.enviarCorreoPreventivo.mockReturnValue(throwError(() => error));
    const c = crear();
    await c.enviarCorreo(fila(1));
    expect(toast.errorHttp).toHaveBeenCalledWith(error, expect.any(String));
    expect(toast.success).not.toHaveBeenCalled();
    expect(c.enviando().size).toBe(0);
  });

  it('no permite un segundo envío mientras el primero está en curso', async () => {
    const c = crear();
    c.enviando.set(new Set([1]));
    await c.enviarCorreo(fila(1));
    expect(confirmacion.confirmar).not.toHaveBeenCalled();
  });

  it('abre el modal de oficio con la fila elegida', () => {
    const c = crear();
    const f = fila(2);
    c.abrirOficio(f);
    expect(c.oficioFila()).toBe(f);
  });
});
