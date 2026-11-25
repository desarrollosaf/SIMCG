import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
} from 'sequelize-typescript';
import { Rol } from './rol.model';
import { Permiso } from './permiso.model';

@Table({ tableName: 'role_has_permissions', timestamps: false })
export class RoleHasPermission extends Model {
  @ForeignKey(() => Permiso)
  @Column({
    type: DataType.BIGINT.UNSIGNED,
    primaryKey: true,
    field: 'permission_id',
  })
  declare permissionId: number;

  @ForeignKey(() => Rol)
  @Column({
    type: DataType.BIGINT.UNSIGNED,
    primaryKey: true,
    field: 'role_id',
  })
  declare roleId: number;
}
