import { Table, Column, Model, DataType } from 'sequelize-typescript';

export const TIPO_CORREO_PREVENTIVO = 1;
export const TIPO_CORREO_REMISION = 2;

// Oficios enviados por declaración. declaracion_id apunta a declaranet.declaraciones
// (otra base, sin FK): se consulta por separado.
@Table({ tableName: 'envio_correos', underscored: true, timestamps: true })
export class EnvioCorreo extends Model {
  @Column({
    type: DataType.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({ type: DataType.BIGINT.UNSIGNED, allowNull: false })
  declare servidorPublicoId: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare declaracionId: number;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  declare fechaEnvio: string;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare tipoCorreo: number;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare total: number;

  // Oficios generados (PDF) para esta declaración; null en registros antiguos.
  @Column({ type: DataType.INTEGER })
  declare totalOficiosGenerados: number | null;

  @Column({ type: DataType.STRING })
  declare noOficio: string | null;

  // Id del servidor público que generó el oficio o envió el correo (varchar en BD).
  @Column({ type: DataType.STRING })
  declare idServidorRealizo: string | null;
}
