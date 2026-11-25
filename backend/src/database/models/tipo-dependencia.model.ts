import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({
  tableName: 'tipo_dependencia',
  underscored: true,
  timestamps: true,
  paranoid: true,
})
export class TipoDependencia extends Model {
  @Column({
    type: DataType.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({ type: DataType.STRING, allowNull: false, field: 'c_presupDep' })
  declare clavePresupuestal: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare nombre: string;
}
