import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Permiso {
  id: number;
  nombre: string;
  descripcion: string | null;
  ruta: string | null;
}

export interface Rol {
  id: number;
  nombre: string;
  descripcion: string | null;
  permisos: Permiso[];
}

@Injectable({ providedIn: 'root' })
export class RolesService {
  private readonly http = inject(HttpClient);

  listRoles(): Observable<Rol[]> {
    return this.http.get<Rol[]>(`${environment.apiUrl}/roles`);
  }
}
