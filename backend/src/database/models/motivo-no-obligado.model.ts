import { Table, Column, Model, DataType } from 'sequelize-typescript';

// Base declaranet (conexión 'declaranet').
@Table({
  tableName: 'motivo_no_obligado',
  underscored: true,
  timestamps: true,
  paranoid: true,
})
export class MotivoNoObligado extends Model {
  @Column({
    type: DataType.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({ type: DataType.STRING, allowNull: false })
  declare causa: string;
}
