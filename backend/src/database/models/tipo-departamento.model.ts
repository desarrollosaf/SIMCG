import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({
  tableName: 'tipo_departamento',
  underscored: true,
  timestamps: true,
  paranoid: true,
})
export class TipoDepartamento extends Model {
  @Column({
    type: DataType.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({ type: DataType.STRING, allowNull: false, field: 'c_presupDepto' })
  declare clavePresupuestalDepto: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare nombre: string;

  @Column({
    type: DataType.BIGINT.UNSIGNED,
    allowNull: false,
    field: 'id_Dependencia',
  })
  declare dependenciaId: number;

  @Column({
    type: DataType.BIGINT.UNSIGNED,
    allowNull: false,
    field: 'id_Direccion',
  })
  declare direccionId: number;

  @Column({ type: DataType.STRING, allowNull: false, field: 'c_presup' })
  declare clavePresupuestal: string;
}
