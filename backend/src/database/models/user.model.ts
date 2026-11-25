import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { ServidorPublico } from './servidor-publico.model';

// Cuenta compartida con Declaranet: SIMCG nunca crea ni cambia contraseñas.
@Table({ tableName: 'users', underscored: true, timestamps: true })
export class User extends Model {
  @Column({
    type: DataType.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @ForeignKey(() => ServidorPublico)
  @Column({ type: DataType.BIGINT.UNSIGNED, allowNull: false })
  declare servidorPublicoId: number;

  @BelongsTo(() => ServidorPublico)
  declare servidor: ServidorPublico;

  @Column({ type: DataType.STRING, allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  declare email: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare password: string;

  @Column({ type: DataType.STRING(100) })
  declare rememberToken: string | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare verificacion: boolean;
}
