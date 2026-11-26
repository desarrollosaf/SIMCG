import { FilaReporte } from '../../core/services/reportes.service';
import { EstadoVisual } from '../../shared/ag-grid/estado-celda';

export const TAMANOS_PAGINA_REPORTE = [10, 20, 50, 100];

export type ClaveOrden =
  | 'nombre'
  | 'curp'
  | 'cargo'
  | 'dependencia'
  | 'tipoMovimiento'
  | 'fechaDeclaracion'
  | 'envio'
  | 'estatus';

export interface Orden {
  clave: ClaveOrden;
  direccion: 'asc' | 'desc';
}

/** Nombre completo; el reporte de preventivos lo muestra en mayúsculas y el de omisos tal cual. */
export function nombreFila(f: FilaReporte, mayusculas = false): string {
  const nombre = [f.nombre, f.primerApellido, f.segundoApellido]
    .filter((p): p is string => !!p && p.trim() !== '')
    .join(' ');
  return mayusculas ? nombre.toUpperCase() : nombre;
}

export function textoFila(valor: string | null | undefined, mayusculas = false): string {
  const texto = valor ?? '';
  return mayusculas ? texto.toUpperCase() : texto;
}

/** Dirección y departamento, que van debajo de la dependencia en gris. */
export function adscripcionSecundaria(f: FilaReporte, mayusculas = false): string {
  const texto = [f.direccion, f.departamento].filter((p) => !!p).join(' · ');
  return mayusculas ? texto.toUpperCase() : texto;
}

/** Columna ENVÍO: «ENVIADA EL: aaaa-mm-dd» o «SIN ENVIO». */
export function envioFila(f: FilaReporte): string {
  return f.fechaEnvio ? `ENVIADA EL: ${(f.fechaEnvio ?? '')}` : 'SIN ENVIO';
}

/** Etiqueta de color del estado del servidor público. */
export function estatusVisual(f: FilaReporte): EstadoVisual {
  const estatus = (f.estatus ?? '').toUpperCase();
  if (estatus.includes('OMISO')) return { texto: f.estatus, tono: 'error' };
  if (estatus.includes('EXTEMPORANEO')) return { texto: f.estatus, tono: 'info' };
  if (estatus.includes('EN TIEMPO')) return { texto: f.estatus, tono: 'ok' };
  return { texto: f.estatus, tono: 'neutro' };
}

const sinAcentos = (t: string): string =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Búsqueda en el navegador sobre las columnas visibles (como el buscador de DataTables). */
export function filtrarFilas(filas: FilaReporte[], texto: string): FilaReporte[] {
  const palabras = sinAcentos(texto.trim()).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return filas;
  return filas.filter((f) => {
    const pajar = sinAcentos(
      [
        nombreFila(f),
        f.curp,
        f.cargo,
        f.dependencia,
        f.direccion,
        f.departamento,
        f.tipoMovimiento,
        f.fechaDeclaracion,
        envioFila(f),
        f.estatus,
      ].join(' '),
    );
    return palabras.every((p) => pajar.includes(p));
  });
}

function valorOrden(f: FilaReporte, clave: ClaveOrden): string {
  switch (clave) {
    case 'nombre':
      return nombreFila(f);
    case 'curp':
      return f.curp ?? '';
    case 'cargo':
      return f.cargo;
    case 'dependencia':
      return f.dependencia;
    case 'tipoMovimiento':
      return f.tipoMovimiento;
    case 'fechaDeclaracion':
      return f.fechaDeclaracion;
    case 'envio':
      return f.fechaEnvio ?? '';
    case 'estatus':
      return f.estatus;
  }
}

export function ordenarFilas(filas: FilaReporte[], orden: Orden | null): FilaReporte[] {
  if (!orden) return filas;
  const signo = orden.direccion === 'asc' ? 1 : -1;
  return [...filas].sort(
    (a, b) =>
      signo *
      valorOrden(a, orden.clave).localeCompare(valorOrden(b, orden.clave), 'es', {
        sensitivity: 'base',
      }),
  );
}
