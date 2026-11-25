import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FilaPrevisualizacionServidor {
  renglon: number;
  curp: string | null;
  nombre: string | null;
  errores: string[];
}

export interface PrevisualizacionServidores {
  total: number;
  validas: number;
  conErrores: number;
  filas: FilaPrevisualizacionServidor[];
}

export interface ResultadoCargaServidores {
  insertados: number;
  omitidos: number;
}

export type EstadoNoObligado = 'aplicar' | 'ya_no_obligado' | 'error';

export interface FilaPrevisualizacionNoObligado {
  renglon: number;
  curp: string | null;
  nombre: string | null;
  tipoMovimiento: string | null;
  fechaMovimiento: string | null;
  estado: EstadoNoObligado;
  errores: string[];
}

export interface PrevisualizacionNoObligados {
  total: number;
  aplicables: number;
  omitidos: number;
  filas: FilaPrevisualizacionNoObligado[];
}

export interface ResultadoCargaNoObligados {
  actualizados: number;
  renglonesAplicados: number;
  omitidos: number;
}

@Injectable({ providedIn: 'root' })
export class CargasService {
  private readonly http = inject(HttpClient);

  private readonly base = `${environment.apiUrl}/cargas`;

  descargarLayoutServidores(): Observable<Blob> {
    return this.http.get(`${this.base}/servidores/layout`, { responseType: 'blob' });
  }

  previsualizarServidores(archivo: File): Observable<PrevisualizacionServidores> {
    return this.http.post<PrevisualizacionServidores>(
      `${this.base}/servidores/previsualizar`,
      this.formulario(archivo),
    );
  }

  confirmarServidores(archivo: File): Observable<ResultadoCargaServidores> {
    return this.http.post<ResultadoCargaServidores>(
      `${this.base}/servidores/confirmar`,
      this.formulario(archivo),
    );
  }

  descargarLayoutNoObligados(): Observable<Blob> {
    return this.http.get(`${this.base}/no-obligados/layout`, { responseType: 'blob' });
  }

  previsualizarNoObligados(archivo: File): Observable<PrevisualizacionNoObligados> {
    return this.http.post<PrevisualizacionNoObligados>(
      `${this.base}/no-obligados/previsualizar`,
      this.formulario(archivo),
    );
  }

  confirmarNoObligados(archivo: File): Observable<ResultadoCargaNoObligados> {
    return this.http.post<ResultadoCargaNoObligados>(
      `${this.base}/no-obligados/confirmar`,
      this.formulario(archivo),
    );
  }

  private formulario(archivo: File): FormData {
    const datos = new FormData();
    datos.append('archivo', archivo);
    return datos;
  }
}
