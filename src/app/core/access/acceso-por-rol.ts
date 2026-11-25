// Única fuente de verdad de qué rol ve qué sección. Los nombres de rol son
// los de la tabla roles de la base compartida con Declaranet.
export const ROL_ADMINISTRADOR = 'Administrador';

export const ROLES_SIMCG = [
  ROL_ADMINISTRADOR,
  'Registro',
  'Consulta',
  'Estadistica',
  'Estadistica2',
] as const;

export type Seccion =
  | 'servidores'
  | 'cargas'
  | 'libros-actas'
  | 'reportes'
  | 'oficios'
  | 'declaraciones-intereses'
  | 'estadisticas'
  | 'administracion';

const SOLO_ADMIN: readonly string[] = [ROL_ADMINISTRADOR];
const LECTURA: readonly string[] = [ROL_ADMINISTRADOR, 'Consulta', 'Estadistica', 'Estadistica2'];

export const ROLES_POR_SECCION: Record<Seccion, readonly string[]> = {
  servidores: ROLES_SIMCG,
  cargas: [ROL_ADMINISTRADOR, 'Registro'],
  reportes: LECTURA,
  estadisticas: LECTURA,
  'libros-actas': SOLO_ADMIN,
  oficios: SOLO_ADMIN,
  'declaraciones-intereses': SOLO_ADMIN,
  administracion: SOLO_ADMIN,
};

export function puedeVer(roles: readonly string[] | null | undefined, seccion: Seccion): boolean {
  const permitidos = ROLES_POR_SECCION[seccion];
  return !!roles?.some((rol) => permitidos.includes(rol));
}

// Acciones dentro de Servidores (el backend las vuelve a validar).
const ESCRIBE_SERVIDORES: readonly string[] = [ROL_ADMINISTRADOR, 'Registro'];
const ELIMINA_MOVIMIENTOS: readonly string[] = [ROL_ADMINISTRADOR, 'Consulta'];

/** Alta, edición y baja de servidores; alta de movimientos y cambio de obligado. */
export function puedeEditarServidores(roles: readonly string[] | null | undefined): boolean {
  return !!roles?.some((rol) => ESCRIBE_SERVIDORES.includes(rol));
}

export function puedeEliminarMovimientos(roles: readonly string[] | null | undefined): boolean {
  return !!roles?.some((rol) => ELIMINA_MOVIMIENTOS.includes(rol));
}
