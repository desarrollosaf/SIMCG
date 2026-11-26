import { ActivityLog } from './activity-log.model';
import { Declaracion } from './declaracion.model';
import { DocumentoSat } from './documento-sat.model';
import { EnvioCorreo } from './envio-correo.model';
import { EstatusDeclaracion } from './estatus-declaracion.model';
import { Folio } from './folio.model';
import { Libro } from './libro.model';
import { ModelHasRole } from './model-has-role.model';
import { MotivoNoObligado } from './motivo-no-obligado.model';
import { Permiso } from './permiso.model';
import { Respuesta } from './respuesta.model';
import { RoleHasPermission } from './role-has-permission.model';
import { Rol } from './rol.model';
import { ServidorPublico } from './servidor-publico.model';
import { TipoDepartamento } from './tipo-departamento.model';
import { TipoDependencia } from './tipo-dependencia.model';
import { TipoDireccion } from './tipo-direccion.model';
import { TipoMovimientoMcg } from './tipo-movimiento-mcg.model';
import { User } from './user.model';

// Las asociaciones entre modelos exigen que todos se registren en la misma conexión.
export const MODELOS_ACCESO = [
  User,
  ServidorPublico,
  TipoDependencia,
  TipoDireccion,
  TipoDepartamento,
  Rol,
  Permiso,
  RoleHasPermission,
  ModelHasRole,
  Folio,
];

// Servidores, catálogos y oficios: conexión principal (cddiputados).
export const MODELOS_SERVIDORES = [
  User,
  ServidorPublico,
  TipoDependencia,
  TipoDireccion,
  TipoDepartamento,
  TipoMovimientoMcg,
  Respuesta,
  EnvioCorreo,
  Libro,
  ActivityLog,
];

// Movimientos: conexión 'declaranet'.
export const MODELOS_DECLARANET = [
  Declaracion,
  MotivoNoObligado,
  DocumentoSat,
  EstatusDeclaracion,
];
