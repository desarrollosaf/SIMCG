import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TipoMovimiento } from './catalogos.service';

export type EstatusServidor = 'obligado' | 'no_obligado' | 'baja' | 'sin_movimiento';

export interface UltimoMovimiento {
  tipo: string | null;
  /** Fecha ISO (yyyy-mm-dd). */
  fecha: string;
}

export interface ServidorFila {
  id: number;
  nombre: string;
  curp: string | null;
  dependencia: string | null;
  direccion: string | null;
  estatus: EstatusServidor;
  /** Obligación según el último movimiento; null si no tiene movimientos. */
  obligado: boolean | null;
  ultimoMovimiento: UltimoMovimiento | null;
}

export interface ServidoresPagina {
  total: number;
  filas: ServidorFila[];
}

export interface ConsultaServidores {
  inicio: number;
  limite: number;
  buscar: string;
  ordenar: 'nombre' | 'curp' | 'dependencia';
  direccion: 'asc' | 'desc';
  estatus?: 'activos' | 'todos' | 'baja';
  obligado?: boolean;
  dependenciaId?: number | null;
}

export interface DatosServidor {
  nombre: string;
  primerApellido: string;
  segundoApellido: string | null;
  rfc: string;
  homoclave: string;
  curp: string;
  cargo: string;
  nivelCargo: string;
  cveIssemym: string | null;
  tipoDependenciaId: number;
  tipoDireccionId: number | null;
  tipoDepartamentoId: number | null;
  honorarios: number;
}

export interface CrearServidor extends DatosServidor {
  fechaInicio: string;
  tipoMovimientoId: number;
  fechaDeclaracion: string;
}

export interface ActualizarServidor extends DatosServidor {
  email?: string;
  /** Obligatorio cuando hay cambios: queda en la bitácora. */
  motivo?: string;
}

export interface MovimientoInicial {
  tipoMovimientoId: number;
  tipo: string | null;
  fecha: string;
}

export interface ServidorDetalle extends DatosServidor {
  id: number;
  fechaInicio: string;
  /** Primer movimiento del servidor (solo lectura en la edición). */
  movimientoInicial: MovimientoInicial | null;
  presentaVersionLarga: boolean;
  puedeVersionLarga: boolean;
  email: string | null;
}

export interface Movimiento {
  id: number;
  tipoMovimientoId: number;
  tipo: string | null;
  fechaDeclaracion: string;
  obligado: boolean;
  motivoNoObligadoId: number | null;
  estado: string;
  estatus: string;
  oficioPreventivo: string | null;
  oficioRemision: string | null;
  fechaEnvio: string | null;
  /** Iniciada / Terminada / Enviada. */
  estatusDeclaracion: string | null;
}

@Injectable({ providedIn: 'root' })
export class ServidoresService {
  private readonly http = inject(HttpClient);

  private readonly base = `${environment.apiUrl}/servidores`;

  listar(consulta: ConsultaServidores): Observable<ServidoresPagina> {
    let params = new HttpParams()
      .set('inicio', consulta.inicio)
      .set('limite', consulta.limite)
      .set('ordenar', consulta.ordenar)
      .set('direccion', consulta.direccion);
    if (consulta.buscar) params = params.set('buscar', consulta.buscar);
    if (consulta.estatus && consulta.estatus !== 'activos') {
      params = params.set('estatus', consulta.estatus);
    }
    if (consulta.obligado) params = params.set('obligado', true);
    if (consulta.dependenciaId) params = params.set('dependenciaId', consulta.dependenciaId);
    return this.http.get<ServidoresPagina>(this.base, { params });
  }

  detalle(id: number): Observable<ServidorDetalle> {
    return this.http.get<ServidorDetalle>(`${this.base}/${id}`);
  }

  crear(datos: CrearServidor): Observable<ServidorDetalle> {
    return this.http.post<ServidorDetalle>(this.base, datos);
  }

  actualizar(id: number, datos: ActualizarServidor): Observable<ServidorDetalle> {
    return this.http.put<ServidorDetalle>(`${this.base}/${id}`, datos);
  }

  baja(id: number, motivo: string): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(`${this.base}/${id}`, { body: { motivo } });
  }

  versionLarga(id: number, presenta: boolean): Observable<{ presentaVersionLarga: boolean }> {
    return this.http.patch<{ presentaVersionLarga: boolean }>(`${this.base}/${id}/version-larga`, {
      presenta,
    });
  }

  movimientos(id: number): Observable<Movimiento[]> {
    return this.http.get<Movimiento[]>(`${this.base}/${id}/movimientos`);
  }

  movimientosPermitidos(id: number): Observable<TipoMovimiento[]> {
    return this.http.get<TipoMovimiento[]>(`${this.base}/${id}/movimientos/permitidos`);
  }

  crearMovimiento(id: number, tipoMovimientoId: number): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(`${this.base}/${id}/movimientos`, { tipoMovimientoId });
  }

  cambiarObligado(
    movimientoId: number,
    obligado: boolean,
    motivoNoObligadoId?: number,
  ): Observable<{ mensaje: string }> {
    return this.http.patch<{ mensaje: string }>(
      `${environment.apiUrl}/movimientos/${movimientoId}/obligado`,
      { obligado, motivoNoObligadoId },
    );
  }

  eliminarMovimiento(movimientoId: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(
      `${environment.apiUrl}/movimientos/${movimientoId}`,
    );
  }
}
