import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UsuarioAcceso {
  id: number;
  nombre: string;
  curp: string | null;
  dependencia: string | null;
  email: string;
  roles: string[];
  verificacion: boolean;
}

export interface DarAcceso {
  rfc: string;
  curp: string;
  homoclave: string;
  rol: string;
}

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly http = inject(HttpClient);

  listar(): Observable<UsuarioAcceso[]> {
    return this.http.get<UsuarioAcceso[]>(`${environment.apiUrl}/usuarios`);
  }

  darAcceso(datos: DarAcceso): Observable<UsuarioAcceso> {
    return this.http.post<UsuarioAcceso>(`${environment.apiUrl}/usuarios/acceso`, datos);
  }

  baja(id: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(`${environment.apiUrl}/usuarios/${id}`);
  }
}
