import { Table, Column, Model, DataType } from 'sequelize-typescript';

// Libros del MCG: un acta (y su soporte) por tipo de movimiento y año.
// `ruta` y `ruta_soporte` son relativas a ARCHIVOS_DIR (ej. 'Actas/2022/x.pdf').
@Table({
  tableName: 'libros',
  underscored: true,
  timestamps: true,
  paranoid: false,
})
export class Libro extends Model {
  @Column({
    type: DataType.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({ type: DataType.BIGINT.UNSIGNED, allowNull: false })
  declare tipoMovimientoId: number;

  @Column({ type: DataType.STRING })
  declare anio: string | null;

  @Column({ type: DataType.STRING, allowNull: false })
  declare ruta: string;

  @Column({ type: DataType.STRING })
  declare rutaSoporte: string | null;
}
