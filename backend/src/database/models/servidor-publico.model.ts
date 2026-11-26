import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasOne,
} from 'sequelize-typescript';
import { TipoDependencia } from './tipo-dependencia.model';
import { TipoDepartamento } from './tipo-departamento.model';
import { TipoDireccion } from './tipo-direccion.model';
import { User } from './user.model';

@Table({
  tableName: 'servidores_publicos',
  underscored: true,
  timestamps: true,
  paranoid: true,
})
export class ServidorPublico extends Model {
  @Column({
    type: DataType.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({ type: DataType.STRING, allowNull: false })
  declare nombre: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare primerApellido: string;

  @Column({ type: DataType.STRING })
  declare segundoApellido: string | null;

  @Column({ type: DataType.STRING })
  declare curp: string | null;

  @Column({ type: DataType.STRING })
  declare rfc: string | null;

  @Column({ type: DataType.STRING })
  declare homoclave: string | null;

  @ForeignKey(() => TipoDependencia)
  @Column({
    type: DataType.BIGINT.UNSIGNED,
    allowNull: false,
    field: 'tipo_dependencia',
  })
  declare tipoDependenciaId: number;

  @BelongsTo(() => TipoDependencia)
  declare dependencia: TipoDependencia;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  declare fechaInicio: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare cargo: string;

  @Column({ type: DataType.STRING, allowNull: false })
  declare nivelCargo: string;

  @Column({ type: DataType.STRING })
  declare cveIssemym: string | null;

  @ForeignKey(() => TipoDireccion)
  @Column({ type: DataType.BIGINT.UNSIGNED, field: 'tipo_direccion' })
  declare tipoDireccionId: number | null;

  @BelongsTo(() => TipoDireccion)
  declare direccion: TipoDireccion | null;

  @ForeignKey(() => TipoDepartamento)
  @Column({ type: DataType.BIGINT.UNSIGNED, field: 'tipo_departamento' })
  declare tipoDepartamentoId: number | null;

  @BelongsTo(() => TipoDepartamento)
  declare departamento: TipoDepartamento | null;

  // Id de respuestas (1 = Sí, 2 = No).
  @Column({ type: DataType.BIGINT.UNSIGNED })
  declare honorarios: number | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare presentaVersionLarga: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare registro: boolean;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  declare verificacion: boolean;

  // Correo personal; se mantiene igual al email del usuario ligado.
  @Column({ type: DataType.STRING, field: 'c_personal' })
  declare cPersonal: string | null;

  // Borrado lógico (baja).
  declare deletedAt: Date | null;

  @HasOne(() => User)
  declare usuario: User;
}
