import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({ tableName: 'permissions', underscored: true, timestamps: true })
export class Permiso extends Model {
  @Column({
    type: DataType.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare guardName: string;

  @Column({ type: DataType.STRING })
  declare description: string | null;

  @Column({ type: DataType.STRING })
  declare ruta: string | null;

  @Column({ type: DataType.INTEGER })
  declare padreId: number | null;
}
