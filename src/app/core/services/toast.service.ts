import { Injectable, signal } from '@angular/core';
import { esErrorDeRed, mensajeDeError } from '../../shared/utils/descarga';

export type ToastTipo = 'success' | 'error' | 'info';

export interface ToastAccion {
  etiqueta: string;
  ejecutar: () => void;
}

export interface OpcionesToast {
  accion?: ToastAccion;
}

export interface Toast {
  id: number;
  tipo: ToastTipo;
  mensaje: string;
  accion?: ToastAccion;
}

export const DURACION_TOAST_MS = 5000;

interface Temporizador {
  handle: ReturnType<typeof setTimeout> | undefined;
  restante: number;
  inicio: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);

  private nextId = 1;
  private readonly temporizadores = new Map<number, Temporizador>();

  success(mensaje: string, opciones?: OpcionesToast): void {
    this.show(mensaje, 'success', opciones);
  }

  error(mensaje: string, opciones?: OpcionesToast): void {
    this.show(mensaje, 'error', opciones);
  }

  info(mensaje: string, opciones?: OpcionesToast): void {
    this.show(mensaje, 'info', opciones);
  }

  /**
   * Error de una petición: usa el mensaje del backend o el de respaldo. Si no hubo conexión
   * (status 0) no muestra nada, porque el interceptor ya avisó de forma global.
   */
  errorHttp(err: unknown, respaldo: string): void {
    if (esErrorDeRed(err)) return;
    this.error(mensajeDeError(err as { error?: { message?: unknown } }) ?? respaldo);
  }

  dismiss(id: number): void {
    const t = this.temporizadores.get(id);
    if (t) clearTimeout(t.handle);
    this.temporizadores.delete(id);
    this.toasts.update((rows) => rows.filter((x) => x.id !== id));
  }

  /** Detiene el cierre automático (cursor o foco sobre el aviso). */
  pausar(id: number): void {
    const t = this.temporizadores.get(id);
    if (!t || t.handle === undefined) return;
    clearTimeout(t.handle);
    t.handle = undefined;
    t.restante = Math.max(0, t.restante - (Date.now() - t.inicio));
  }

  /** Reanuda el cierre automático con el tiempo que faltaba. */
  reanudar(id: number): void {
    const t = this.temporizadores.get(id);
    if (!t || t.handle !== undefined) return;
    this.programar(id, t);
  }

  private show(mensaje: string, tipo: ToastTipo, opciones?: OpcionesToast): void {
    const id = this.nextId++;
    this.toasts.update((rows) => [...rows, { id, tipo, mensaje, accion: opciones?.accion }]);
    const t: Temporizador = { handle: undefined, restante: DURACION_TOAST_MS, inicio: 0 };
    this.temporizadores.set(id, t);
    this.programar(id, t);
  }

  private programar(id: number, t: Temporizador): void {
    t.inicio = Date.now();
    t.handle = setTimeout(() => this.dismiss(id), t.restante);
  }
}
