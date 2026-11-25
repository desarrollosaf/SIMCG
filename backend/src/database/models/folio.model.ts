import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({
  tableName: 'folios',
  underscored: true,
  timestamps: true,
  paranoid: true,
})
export class Folio extends Model {
  @Column({
    type: DataType.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({ type: DataType.BIGINT, allowNull: false })
  declare foliosableId: number;

  @Column({ type: DataType.STRING, allowNull: false })
  declare foliosableType: string;

  // La columna es varchar; el consecutivo se calcula con CAST a entero.
  @Column({ type: DataType.STRING })
  declare noFolio: string | null;

  @Column({ type: DataType.BIGINT.UNSIGNED })
  declare tipoOficioId: number | null;
}
