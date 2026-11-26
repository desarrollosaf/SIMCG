import { ParamMap, Params } from '@angular/router';

export const TAMANOS_PAGINA = [10, 20, 50];

export interface EstadoLista {
  buscar: string;
  /** Base 0 internamente; en la URL va base 1. */
  pagina: number;
  limite: number;
  ordenar: 'nombre' | 'curp' | 'dependencia';
  direccion: 'asc' | 'desc';
  /** 'activos' (por defecto), 'todos' (incluye bajas) o 'baja' (solo bajas). */
  estatus: 'activos' | 'todos' | 'baja';
  /** Solo servidores activos cuyo último movimiento es obligado (implica estatus 'activos'). */
  obligado: boolean;
  /** Id de dependencia; null = todas. */
  dependenciaId: number | null;
}

export const ESTADO_INICIAL: EstadoLista = {
  buscar: '',
  pagina: 0,
  limite: TAMANOS_PAGINA[0],
  ordenar: 'nombre',
  direccion: 'asc',
  estatus: 'activos',
  obligado: false,
  dependenciaId: null,
};

/** Lee el estado de la lista de los query params, ignorando valores inválidos. */
export function leerEstado(params: ParamMap): EstadoLista {
  const pagina = Number.parseInt(params.get('pagina') ?? '', 10);
  const limite = Number.parseInt(params.get('limite') ?? '', 10);
  const dependencia = Number.parseInt(params.get('dependencia') ?? '', 10);
  const estatus = params.get('estatus');
  const orden = params.get('orden');
  const obligado = params.get('obligado') === '1';
  return {
    buscar: (params.get('buscar') ?? '').trim(),
    pagina: Number.isFinite(pagina) && pagina >= 1 ? pagina - 1 : ESTADO_INICIAL.pagina,
    limite: TAMANOS_PAGINA.includes(limite) ? limite : ESTADO_INICIAL.limite,
    ordenar: orden === 'curp' || orden === 'dependencia' ? orden : 'nombre',
    direccion: params.get('dir') === 'desc' ? 'desc' : 'asc',
    // La obligación solo aplica a servidores activos: con «obligado» el estatus es siempre «activos».
    estatus: obligado
      ? 'activos'
      : estatus === 'todos' || estatus === 'baja'
        ? estatus
        : ESTADO_INICIAL.estatus,
    obligado,
    dependenciaId: Number.isFinite(dependencia) && dependencia >= 1 ? dependencia : null,
  };
}

/** Query params del estado; los valores por defecto van en null para quitarlos de la URL. */
export function aQueryParams(estado: EstadoLista): Params {
  return {
    buscar: estado.buscar || null,
    pagina: estado.pagina > 0 ? estado.pagina + 1 : null,
    limite: estado.limite !== ESTADO_INICIAL.limite ? estado.limite : null,
    orden: estado.ordenar !== ESTADO_INICIAL.ordenar ? estado.ordenar : null,
    dir: estado.direccion !== ESTADO_INICIAL.direccion ? estado.direccion : null,
    estatus: estado.estatus !== ESTADO_INICIAL.estatus ? estado.estatus : null,
    obligado: estado.obligado ? 1 : null,
    dependencia: estado.dependenciaId,
  };
}

export function mismoEstado(a: EstadoLista, b: EstadoLista): boolean {
  return (
    a.buscar === b.buscar &&
    a.pagina === b.pagina &&
    a.limite === b.limite &&
    a.ordenar === b.ordenar &&
    a.direccion === b.direccion &&
    a.estatus === b.estatus &&
    a.obligado === b.obligado &&
    a.dependenciaId === b.dependenciaId
  );
}

/** Cantidad de filtros rápidos activos (distintos de su valor por defecto). */
export function filtrosActivos(estado: EstadoLista): number {
  return (
    (estado.estatus !== ESTADO_INICIAL.estatus ? 1 : 0) +
    (estado.obligado ? 1 : 0) +
    (estado.dependenciaId !== null ? 1 : 0)
  );
}
