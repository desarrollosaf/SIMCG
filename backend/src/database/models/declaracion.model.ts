import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { MotivoNoObligado } from './motivo-no-obligado.model';

export const ESTATUS_DECLARACION_INICIAL = 1;
// Motivo 'OTRO' del catálogo motivo_no_obligado (1 defunción, 2 incapacidad).
export const MOTIVO_NO_OBLIGADO_OTRO = 3;

// Base declaranet (conexión 'declaranet'; tabla MyISAM, sin FKs ni transacciones).
// Solo se mapean las columnas que SIMCG lee o escribe.
@Table({
  tableName: 'declaraciones',
  underscored: true,
  timestamps: true,
  paranoid: true,
})
export class Declaracion extends Model {
  @Column({
    type: DataType.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({ type: DataType.BIGINT.UNSIGNED, allowNull: false })
  declare servidorPublicoId: number;

  @Column({ type: DataType.BIGINT.UNSIGNED, allowNull: false })
  declare tipoMovimientoId: number;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  declare fechaDeclaracion: string;

  @Column({ type: DataType.DATEONLY })
  declare fechaEnvio: string | null;

  @Column({ type: DataType.DATEONLY })
  declare fechaEnvioAclaracion: string | null;

  @Column({ type: DataType.BIGINT.UNSIGNED, allowNull: false })
  declare estatusDeclaracionId: number;

  // En esta tabla es tinyint (id de respuestas: 1 = Sí, 2 = No).
  @Column({ type: DataType.TINYINT })
  declare honorarios: number | null;

  @Column({ type: DataType.STRING })
  declare cargo: string | null;

  @Column({ type: DataType.STRING })
  declare nivelCargo: string | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  declare obligado: boolean;

  @ForeignKey(() => MotivoNoObligado)
  @Column({ type: DataType.BIGINT.UNSIGNED })
  declare motivoNoObligadoId: number | null;

  @BelongsTo(() => MotivoNoObligado)
  declare motivoNoObligado: MotivoNoObligado | null;

  // Campos escalares que un movimiento nuevo hereda del anterior.
  @Column({ type: DataType.STRING })
  declare correoInstitucional: string | null;

  @Column({ type: DataType.STRING })
  declare correoPersonal: string | null;

  @Column({ type: DataType.STRING })
  declare telefonoCasa: string | null;

  @Column({ type: DataType.STRING })
  declare telefonoPersonal: string | null;

  @Column({ type: DataType.BIGINT.UNSIGNED })
  declare situacionPersonalId: number | null;

  @Column({ type: DataType.BIGINT.UNSIGNED })
  declare regimenMatrimonialId: number | null;

  @Column({ type: DataType.BIGINT.UNSIGNED })
  declare paisId: number | null;

  @Column({ type: DataType.STRING })
  declare nacionalidad: string | null;

  @Column({ type: DataType.BIGINT.UNSIGNED })
  declare nacionalidadId: number | null;

  @Column({ type: DataType.STRING })
  declare regimenEspecificar: string | null;

  @Column({ type: DataType.TEXT })
  declare observaciones: string | null;

  @Column({ type: DataType.STRING })
  declare regimenMatrimonial: string | null;
}
