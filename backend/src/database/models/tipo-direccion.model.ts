import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({
  tableName: 'tipo_direccion',
  underscored: true,
  timestamps: true,
  paranoid: true,
})
export class TipoDireccion extends Model {
  @Column({
    type: DataType.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({ type: DataType.STRING, allowNull: false, field: 'c_presupDir' })
  declare clavePresupuestal: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare nombre: string;

  @Column({
    type: DataType.BIGINT.UNSIGNED,
    allowNull: false,
    field: 'id_Dependencia',
  })
  declare dependenciaId: number;
}
