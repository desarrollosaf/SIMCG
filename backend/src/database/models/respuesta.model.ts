import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({ tableName: 'respuestas', underscored: true, timestamps: true })
export class Respuesta extends Model {
  @Column({
    type: DataType.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({ type: DataType.STRING, allowNull: false })
  declare respuesta: string;
}
