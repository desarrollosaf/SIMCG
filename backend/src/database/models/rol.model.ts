import {
  Table,
  Column,
  Model,
  DataType,
  BelongsToMany,
} from 'sequelize-typescript';
import { Permiso } from './permiso.model';
import { RoleHasPermission } from './role-has-permission.model';

@Table({ tableName: 'roles', underscored: true, timestamps: true })
export class Rol extends Model {
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

  @BelongsToMany(() => Permiso, () => RoleHasPermission)
  declare permisos: Permiso[];
}
