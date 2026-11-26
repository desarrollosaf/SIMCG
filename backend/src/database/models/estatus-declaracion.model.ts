import { Table, Column, Model, DataType } from 'sequelize-typescript';

// Base declaranet (conexión 'declaranet'): 1 Iniciada, 2 Terminada, 3 Enviada.
@Table({
  tableName: 'estatus_declaraciones',
  underscored: true,
  timestamps: true,
  paranoid: true,
})
export class EstatusDeclaracion extends Model {
  @Column({
    type: DataType.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({ type: DataType.STRING, allowNull: false })
  declare estatus: string;
}
