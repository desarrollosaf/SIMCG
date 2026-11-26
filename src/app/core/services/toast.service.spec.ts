import { TestBed } from '@angular/core/testing';
import { DURACION_TOAST_MS, ToastService } from './toast.service';

describe('ToastService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const servicio = () => TestBed.inject(ToastService);

  it('se cierra solo tras la duración', () => {
    const s = servicio();
    s.success('Listo');
    expect(s.toasts().length).toBe(1);
    vi.advanceTimersByTime(DURACION_TOAST_MS + 1);
    expect(s.toasts().length).toBe(0);
  });

  it('pausar detiene el cierre y reanudar lo continúa con el tiempo restante', () => {
    const s = servicio();
    s.info('Hola');
    const id = s.toasts()[0].id;

    vi.advanceTimersByTime(1000);
    s.pausar(id);
    vi.advanceTimersByTime(DURACION_TOAST_MS * 2);
    expect(s.toasts().length).toBe(1);

    s.reanudar(id);
    vi.advanceTimersByTime(DURACION_TOAST_MS - 1000 - 1);
    expect(s.toasts().length).toBe(1);
    vi.advanceTimersByTime(2);
    expect(s.toasts().length).toBe(0);
  });

  it('guarda la acción opcional y sigue siendo compatible sin ella', () => {
    const s = servicio();
    const ejecutar = vi.fn();
    s.error('Falló', { accion: { etiqueta: 'Reintentar', ejecutar } });
    s.info('Sin acción');
    const [con, sin] = s.toasts();
    expect(con.accion?.etiqueta).toBe('Reintentar');
    con.accion!.ejecutar();
    expect(ejecutar).toHaveBeenCalled();
    expect(sin.accion).toBeUndefined();
  });

  it('errorHttp muestra el mensaje del backend o el de respaldo, y omite fallas de red', () => {
    const s = servicio();
    s.errorHttp({ status: 400, error: { message: ['a', 'b'] } }, 'respaldo');
    s.errorHttp({ status: 500, error: {} }, 'respaldo');
    s.errorHttp({ status: 0 }, 'respaldo');
    expect(s.toasts().map((t) => t.mensaje)).toEqual(['a b', 'respaldo']);
  });
});
