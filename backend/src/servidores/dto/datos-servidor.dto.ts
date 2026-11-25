import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Mayusculas, MayusculasONulo } from './normalizar';

export const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Datos del servidor público que se capturan en el alta y se pueden editar.
// Mismas reglas que valida el formulario del frontend.
export class DatosServidorDto {
  @Mayusculas()
  @IsString({ message: 'El nombre es obligatorio' })
  @Length(1, 191, {
    message: 'El nombre es obligatorio (máximo 191 caracteres)',
  })
  nombre!: string;

  @Mayusculas()
  @IsString({ message: 'El primer apellido es obligatorio' })
  @Length(1, 191, {
    message: 'El primer apellido es obligatorio (máximo 191 caracteres)',
  })
  primerApellido!: string;

  @MayusculasONulo()
  @IsOptional()
  @IsString()
  @MaxLength(191, {
    message: 'El segundo apellido admite máximo 191 caracteres',
  })
  segundoApellido?: string | null;

  @Mayusculas()
  @IsString()
  @Matches(/^[A-ZÑ&]{4}\d{6}$/, {
    message: 'El RFC no tiene un formato válido',
  })
  rfc!: string;

  @Mayusculas()
  @IsString()
  @Matches(/^[A-Z\d]{3}$/, {
    message: 'La homoclave no tiene un formato válido',
  })
  homoclave!: string;

  @Mayusculas()
  @IsString()
  @Length(18, 18, { message: 'La CURP debe tener 18 caracteres' })
  @Matches(/^[A-Z]{4}\d{6}[HMX][A-Z]{5}[A-Z\d]\d$/, {
    message: 'La CURP no tiene un formato válido',
  })
  curp!: string;

  @Mayusculas()
  @IsString({ message: 'El cargo es obligatorio' })
  @Length(1, 191, {
    message: 'El cargo es obligatorio (máximo 191 caracteres)',
  })
  cargo!: string;

  @Mayusculas()
  @IsString()
  @Matches(/^\d{2}-\d$/, {
    message: 'El nivel del cargo debe tener el formato 00-0',
  })
  nivelCargo!: string;

  @MayusculasONulo()
  @IsOptional()
  @Matches(/^\d{7}$/, { message: 'La clave ISSEMYM debe tener 7 dígitos' })
  cveIssemym?: string | null;

  @Type(() => Number)
  @IsInt({ message: 'Selecciona la dependencia' })
  @Min(1, { message: 'Selecciona la dependencia' })
  tipoDependenciaId!: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  tipoDireccionId?: number | null;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  tipoDepartamentoId?: number | null;

  // Id del catálogo respuestas (1 = Sí, 2 = No): ¿contratado por honorarios?
  @Type(() => Number)
  @IsInt({ message: 'Indica si está contratado por honorarios' })
  @Min(1, { message: 'Indica si está contratado por honorarios' })
  honorarios!: number;
}
