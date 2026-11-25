import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Dependencia {
  id: number;
  nombre: string;
}

export interface Direccion extends Dependencia {
  dependenciaId: number;
}

export interface Departamento extends Dependencia {
  direccionId: number;
}

export interface TipoMovimiento {
  id: number;
  valor: string;
}

export interface Respuesta {
  id: number;
  respuesta: string;
}

export interface MotivoNoObligado {
  id: number;
  causa: string;
}

@Injectable({ providedIn: 'root' })
export class CatalogosService {
  private readonly http = inject(HttpClient);

  private readonly base = `${environment.apiUrl}/catalogos`;

  dependencias(): Observable<Dependencia[]> {
    return this.http.get<Dependencia[]>(`${this.base}/dependencias`);
  }

  direcciones(dependenciaId: number): Observable<Direccion[]> {
    const params = new HttpParams().set('dependencia', dependenciaId);
    return this.http.get<Direccion[]>(`${this.base}/direcciones`, { params });
  }

  departamentos(direccionId: number): Observable<Departamento[]> {
    const params = new HttpParams().set('direccion', direccionId);
    return this.http.get<Departamento[]>(`${this.base}/departamentos`, { params });
  }

  tiposMovimiento(): Observable<TipoMovimiento[]> {
    return this.http.get<TipoMovimiento[]>(`${this.base}/tipos-movimiento`);
  }

  respuestas(): Observable<Respuesta[]> {
    return this.http.get<Respuesta[]>(`${this.base}/respuestas`);
  }

  motivosNoObligado(): Observable<MotivoNoObligado[]> {
    return this.http.get<MotivoNoObligado[]>(`${this.base}/motivos-no-obligado`);
  }
}
