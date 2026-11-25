import {
  TIPO_MOV_CONCLUSION,
  TIPO_MOV_INGRESO,
  TIPO_MOV_MODIFICACION,
  TIPO_MOV_REINGRESO,
} from '../database/models/tipo-movimiento-mcg.model';

// Reglas de negocio del MCG como funciones puras (sin BD ni reloj), copiadas del
// sistema viejo (McgDeclaranteController::tipe y ::selectMov). Las fechas son
// cadenas 'YYYY-MM-DD', que se comparan bien como texto.

export const ESTATUS_OMISO = 'OMISO';
export const ESTATUS_EN_TIEMPO = 'EN TIEMPO';
export const ESTATUS_ENVIO_EXTEMPORANEO = 'ENVIO EXTEMPORANEO';
// El sistema viejo devolvía 'ENVIO EN TIEMPO ' (con espacio final); aquí se recorta.
export const ESTATUS_ENVIO_EN_TIEMPO = 'ENVIO EN TIEMPO';

const ZONA_HORARIA = 'America/Mexico_City';
const PLAZO_DIAS = 60;
const PLAZO_MODIFICACION_DIAS = 30;
// En 2021 se amplió el plazo de las modificaciones.
const PLAZO_MODIFICACION_2021_DIAS = 91;
const ANIO_PLAZO_EXTENDIDO = '2021';

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria de México. */
export function hoyMexico(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

export function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const resultado = new Date(Date.UTC(anio, mes - 1, dia + dias));
  return resultado.toISOString().slice(0, 10);
}

export function fechaLimite(
  tipoMovimientoId: number,
  fechaDeclaracion: string,
): string {
  if (tipoMovimientoId !== TIPO_MOV_MODIFICACION) {
    return sumarDias(fechaDeclaracion, PLAZO_DIAS);
  }
  const dias = fechaDeclaracion.startsWith(ANIO_PLAZO_EXTENDIDO)
    ? PLAZO_MODIFICACION_2021_DIAS
    : PLAZO_MODIFICACION_DIAS;
  return sumarDias(fechaDeclaracion, dias);
}

export interface EntradaEstatus {
  tipoMovimientoId: number;
  fechaDeclaracion: string;
  fechaEnvio: string | null;
  hoy: string;
}

/** Estatus de cumplimiento de una declaración (sin considerar si es obligado). */
export function calcularEstatus(e: EntradaEstatus): string {
  const limite = fechaLimite(e.tipoMovimientoId, e.fechaDeclaracion);
  if (!e.fechaEnvio) {
    return limite < e.hoy ? ESTATUS_OMISO : ESTATUS_EN_TIEMPO;
  }
  return e.fechaEnvio > limite
    ? ESTATUS_ENVIO_EXTEMPORANEO
    : ESTATUS_ENVIO_EN_TIEMPO;
}

/** Texto de la columna "estado": OBLIGADO / NO OBLIGADO [- causa]. */
export function estadoObligado(
  obligado: boolean,
  causa: string | null | undefined,
): string {
  if (obligado) return 'OBLIGADO';
  return causa ? `NO OBLIGADO - ${causa}` : 'NO OBLIGADO';
}

export interface UltimoMovimiento {
  tipoMovimientoId: number;
  fechaDeclaracion: string;
}

/**
 * Tipos de movimiento que se pueden registrar hoy (selectMov del sistema viejo),
 * según el último movimiento del año en curso. Sin movimiento este año: todos.
 *
 * - Último REINGRESO: no se ofrece INGRESO. (El viejo comparaba contra el año
 *   como texto, así que en la práctica nunca se volvía a ofrecer en el mismo año.)
 * - Último CONCLUSION en marzo: no se ofrece MODIFICACION.
 * - Último INGRESO hasta el 31 de mayo: no se ofrece MODIFICACION.
 */
export function tiposPermitidos(
  todos: number[],
  ultimo: UltimoMovimiento | null,
  anioActual: string,
): number[] {
  if (!ultimo) return todos;

  const excluir = (id: number) => todos.filter((t) => t !== id);
  switch (ultimo.tipoMovimientoId) {
    case TIPO_MOV_REINGRESO:
      return excluir(TIPO_MOV_INGRESO);
    case TIPO_MOV_CONCLUSION:
      return ultimo.fechaDeclaracion.slice(5, 7) === '03'
        ? excluir(TIPO_MOV_MODIFICACION)
        : todos;
    case TIPO_MOV_INGRESO:
      return ultimo.fechaDeclaracion <= `${anioActual}-05-31`
        ? excluir(TIPO_MOV_MODIFICACION)
        : todos;
    default:
      return todos;
  }
}

/** La versión larga solo aplica a niveles 25 a 43 y 46 (nivel_cargo con forma "NN-D"). */
export function permiteVersionLarga(nivelCargo: string): boolean {
  const nivel = Number.parseInt(nivelCargo.split('-')[0], 10);
  return (nivel >= 25 && nivel <= 43) || nivel === 46;
}
