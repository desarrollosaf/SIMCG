import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, OperatorFunction, catchError, from, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FilaReporte {
  /** Id de la declaración. */
  id: number;
  servidorId: number;
  nombre: string;
  primerApellido: string;
  segundoApellido: string | null;
  curp: string | null;
  cargo: string;
  dependencia: string;
  direccion: string;
  departamento: string;
  tipoMovimientoId: number;
  tipoMovimiento: string;
  fechaDeclaracion: string;
  fechaEnvio: string | null;
  estatus: string;
}

export type TipoReporteCorreo = 'PREVENTIVO' | 'REMISION';

export interface OficioOmisoSolicitud {
  declaracionId: number;
  folio: string;
  folioDadp: string;
  fechaOficio: string;
  fechaPadron: string;
  soporte: string;
}

export interface OficioPreventivoSolicitud {
  declaracionId: number;
  folio: string;
  fechaOficio: string;
}

/**
 * Con responseType blob, un error JSON del servidor llega como Blob: se vuelve a
 * leer para que `ToastService.errorHttp` encuentre el mensaje.
 */
export function leerErrorDeBlob<T>(): OperatorFunction<T, T> {
  return catchError((err: unknown) => {
    if (!(err instanceof HttpErrorResponse) || !(err.error instanceof Blob)) {
      return throwError(() => err);
    }
    return from(err.error.text()).pipe(
      switchMap((texto) => {
        let cuerpo: unknown = null;
        try {
          cuerpo = JSON.parse(texto);
        } catch {
          /* el cuerpo no era JSON: se deja vacío */
        }
        return throwError(
          () =>
            new HttpErrorResponse({
              error: cuerpo,
              status: err.status,
              statusText: err.statusText,
              url: err.url ?? undefined,
              headers: err.headers,
            }),
        );
      }),
    );
  });
}

@Injectable({ providedIn: 'root' })
export class ReportesService {
  private readonly http = inject(HttpClient);

  private readonly base = `${environment.apiUrl}/reportes`;

  omisos(fechaInicio: string, fechaFin: string): Observable<FilaReporte[]> {
    const params = new HttpParams().set('fecha_inicio', fechaInicio).set('fecha_fin', fechaFin);
    return this.http.get<FilaReporte[]>(`${this.base}/omisos`, { params });
  }

  preventivos(): Observable<FilaReporte[]> {
    return this.http.get<FilaReporte[]>(`${this.base}/preventivos`);
  }

  /** Número de oficio ya registrado para la declaración (remisión), o null. */
  oficioPrevioOmiso(declaracionId: number): Observable<{ noOficio: string | null }> {
    return this.http.get<{ noOficio: string | null }>(
      `${this.base}/omisos/${declaracionId}/oficio-previo`,
    );
  }

  oficioPrevioPreventivo(declaracionId: number): Observable<{ noOficio: string | null }> {
    return this.http.get<{ noOficio: string | null }>(
      `${this.base}/preventivos/${declaracionId}/oficio-previo`,
    );
  }

  generarOficioOmiso(datos: OficioOmisoSolicitud): Observable<Blob> {
    return this.http
      .post(`${this.base}/omisos/oficio`, datos, { responseType: 'blob' })
      .pipe(leerErrorDeBlob());
  }

  generarOficioPreventivo(datos: OficioPreventivoSolicitud): Observable<Blob> {
    return this.http
      .post(`${this.base}/preventivos/oficio`, datos, { responseType: 'blob' })
      .pipe(leerErrorDeBlob());
  }

  enviarCorreoPreventivo(declaracionId: number): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(
      `${this.base}/preventivos/${declaracionId}/correo`,
      {},
    );
  }

  excelCorreos(
    tipo: TipoReporteCorreo,
    fechaInicio: string,
    fechaFin: string,
  ): Observable<HttpResponse<Blob>> {
    const params = new HttpParams()
      .set('tipo', tipo)
      .set('fecha_inicio', fechaInicio)
      .set('fecha_fin', fechaFin);
    return this.http
      .get(`${this.base}/correos/excel`, { params, responseType: 'blob', observe: 'response' })
      .pipe(leerErrorDeBlob());
  }
}
