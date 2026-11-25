import { Table, Column, Model, DataType } from 'sequelize-typescript';

// Base declaranet (conexión 'declaranet'). Documentos del SAT ligados a una
// declaración; los de requiere_cargar_evidencia = 1 son los de revisión fiscal.
@Table({
  tableName: 'documento_sats',
  underscored: true,
  timestamps: true,
  paranoid: false,
})
export class DocumentoSat extends Model {
  @Column({
    type: DataType.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({ type: DataType.BIGINT.UNSIGNED, allowNull: false })
  declare declaracionId: number;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare requiereCargarEvidencia: boolean;

  @Column({ type: DataType.STRING })
  declare ruta: string | null;
}
