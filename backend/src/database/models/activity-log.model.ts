import { Table, Column, Model, DataType } from 'sequelize-typescript';

// Bitácora compartida con el sistema viejo (spatie/laravel-activitylog), base cddiputados.
// properties guarda JSON; la migración 20261126000000 lo amplía a TEXT.
@Table({ tableName: 'activity_log', underscored: true, timestamps: true })
export class ActivityLog extends Model {
  @Column({
    type: DataType.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({ type: DataType.STRING })
  declare logName: string | null;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare description: string;

  @Column({ type: DataType.STRING })
  declare subjectType: string | null;

  @Column({ type: DataType.BIGINT.UNSIGNED })
  declare subjectId: number | null;

  @Column({ type: DataType.STRING })
  declare causerType: string | null;

  @Column({ type: DataType.BIGINT.UNSIGNED })
  declare causerId: number | null;

  @Column({ type: DataType.TEXT })
  declare properties: string | null;
}
