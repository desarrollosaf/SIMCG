import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type TipoLibro = 'inicial' | 'modificacion' | 'conclusion';

export interface ResumenTipo {
  total: number;
  fiscal: number;
  aclaraciones: number;
}

export interface ResumenLibros {
  anio: number;
  inicial: ResumenTipo;
  modificacion: ResumenTipo;
  conclusion: ResumenTipo;
}

export interface DeclaracionLibro {
  id: number;
  servidorId: number;
  nombre: string;
  cargo: string;
  curp: string;
  dependencia: string | null;
  direccion: string | null;
  tipoMovimiento: string;
  fechaEnvio: string;
}

export interface DeclaracionesPagina {
  total: number;
  filas: DeclaracionLibro[];
}

export interface ConsultaDeclaraciones {
  anio: number;
  tipo: TipoLibro;
  buscar: string;
  inicio: number;
  limite: number;
}

export interface ActaCierre {
  tipo: TipoLibro;
  tipoMovimientoId: number;
  id: number | null;
  anio: number;
  tieneActa: boolean;
  nombreActa: string | null;
  tieneSoporte: boolean;
  actualizado: string | null;
}

export type ArchivoActa = 'acta' | 'soporte';

@Injectable({ providedIn: 'root' })
export class LibrosService {
  private readonly http = inject(HttpClient);

  private readonly base = `${environment.apiUrl}/libros`;

  anios(): Observable<number[]> {
    return this.http.get<number[]>(`${this.base}/anios`);
  }

  resumen(anio: number): Observable<ResumenLibros> {
    return this.http.get<ResumenLibros>(`${this.base}/resumen`, {
      params: new HttpParams().set('anio', anio),
    });
  }

  declaraciones(consulta: ConsultaDeclaraciones): Observable<DeclaracionesPagina> {
    let params = new HttpParams()
      .set('anio', consulta.anio)
      .set('tipo', consulta.tipo)
      .set('inicio', consulta.inicio)
      .set('limite', consulta.limite);
    if (consulta.buscar) params = params.set('buscar', consulta.buscar);
    return this.http.get<DeclaracionesPagina>(`${this.base}/declaraciones`, { params });
  }

  actas(anio: number): Observable<ActaCierre[]> {
    return this.http.get<ActaCierre[]>(`${this.base}/actas`, {
      params: new HttpParams().set('anio', anio),
    });
  }

  guardarActa(archivo: File, anio: number, tipo: TipoLibro): Observable<ActaCierre> {
    const datos = new FormData();
    datos.append('archivo', archivo);
    datos.append('anio', String(anio));
    datos.append('tipo', tipo);
    return this.http.post<ActaCierre>(`${this.base}/actas`, datos);
  }

  descargarArchivo(id: number, archivo: ArchivoActa): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.base}/actas/${id}/${archivo}`, {
      responseType: 'blob',
      observe: 'response',
    });
  }
}
