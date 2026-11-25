import { Table, Column, Model, DataType } from 'sequelize-typescript';

// Ids fijos del catálogo tipo_movimientos_mcg.
export const TIPO_MOV_INGRESO = 1;
export const TIPO_MOV_REINGRESO = 2;
export const TIPO_MOV_MODIFICACION = 3;
export const TIPO_MOV_CONCLUSION = 4;
// Las declaraciones de intereses viven en su propio módulo, no en el MCG.
export const TIPO_MOV_INTERESES = 5;

@Table({
  tableName: 'tipo_movimientos_mcg',
  underscored: true,
  timestamps: true,
  paranoid: true,
})
export class TipoMovimientoMcg extends Model {
  @Column({
    type: DataType.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({ type: DataType.STRING, allowNull: false })
  declare valor: string;
}
