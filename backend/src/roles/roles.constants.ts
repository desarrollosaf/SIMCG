// Nombres tal cual están en la tabla roles de la base compartida con Declaranet.
export const ROL_ADMINISTRADOR = 'Administrador';
export const ROLES_SIMCG = [
  ROL_ADMINISTRADOR,
  'Registro',
  'Consulta',
  'Estadistica',
  'Estadistica2',
] as const;
export type RolSimcg = (typeof ROLES_SIMCG)[number];
