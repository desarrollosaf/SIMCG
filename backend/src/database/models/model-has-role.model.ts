import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Rol } from './rol.model';

// Tabla polimórfica de Laravel (Spatie): model_type guarda el nombre de la clase.
export const MODEL_TYPE_USER = String.raw`App\User`;

@Table({ tableName: 'model_has_roles', timestamps: false })
export class ModelHasRole extends Model {
  @ForeignKey(() => Rol)
  @Column({
    type: DataType.BIGINT.UNSIGNED,
    primaryKey: true,
    field: 'role_id',
  })
  declare roleId: number;

  @BelongsTo(() => Rol)
  declare rol: Rol;

  @Column({ type: DataType.STRING, primaryKey: true, field: 'model_type' })
  declare modelType: string;

  @Column({
    type: DataType.BIGINT.UNSIGNED,
    primaryKey: true,
    field: 'model_id',
  })
  declare modelId: number;
}
