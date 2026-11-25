import { Transform } from 'class-transformer';
import { IsIn, IsString, Length, Matches } from 'class-validator';
import { ROLES_SIMCG } from '../../roles/roles.constants';
import type { RolSimcg } from '../../roles/roles.constants';

const normalizar = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class AccesoDto {
  @Transform(normalizar)
  @IsString()
  @Length(10, 10, { message: 'El RFC debe tener 10 caracteres' })
  @Matches(/^[A-ZÑ&]{4}\d{6}$/, {
    message: 'El RFC no tiene un formato válido',
  })
  rfc!: string;

  @Transform(normalizar)
  @IsString()
  @Length(18, 18, { message: 'La CURP debe tener 18 caracteres' })
  @Matches(/^[A-Z]{4}\d{6}[HMX][A-Z]{5}[A-Z\d]\d$/, {
    message: 'La CURP no tiene un formato válido',
  })
  curp!: string;

  @Transform(normalizar)
  @IsString()
  @Length(3, 3, { message: 'La homoclave debe tener 3 caracteres' })
  @Matches(/^[A-Z\d]{3}$/, {
    message: 'La homoclave no tiene un formato válido',
  })
  homoclave!: string;

  @IsIn(ROLES_SIMCG, { message: 'El rol no es válido' })
  rol!: RolSimcg;
}
