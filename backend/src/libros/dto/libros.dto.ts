import { Type } from 'class-transformer';
import {
  IsIn,
  ValidateBy,
  ValidationOptions,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Recortar } from '../../servidores/dto/normalizar';

export const TIPOS_LIBRO = ['inicial', 'modificacion', 'conclusion'] as const;
export type TipoLibro = (typeof TIPOS_LIBRO)[number];

// El tope (año actual + 1) se calcula en cada validación, no al arrancar.
const AnioNoFuturo = (opciones?: ValidationOptions) =>
  ValidateBy(
    {
      name: 'anioNoFuturo',
      validator: {
        validate: (valor: unknown) =>
          typeof valor === 'number' && valor <= new Date().getFullYear() + 1,
      },
    },
    opciones,
  );

export class AnioDto {
  @Type(() => Number)
  @IsInt({ message: 'El año no es válido' })
  @Min(2000, { message: 'El año no es válido' })
  @AnioNoFuturo({ message: 'El año no es válido' })
  anio!: number;
}

export class ListarDeclaracionesLibroDto extends AnioDto {
  @IsIn(TIPOS_LIBRO, {
    message: 'El tipo debe ser inicial, modificacion o conclusion',
  })
  tipo!: TipoLibro;

  @Recortar()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  buscar?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  inicio?: number = 0;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number = 10;
}

// Campos de texto que acompañan al archivo del acta (multipart).
export class SubirActaDto extends AnioDto {
  @IsIn(TIPOS_LIBRO, {
    message: 'El tipo debe ser inicial, modificacion o conclusion',
  })
  tipo!: TipoLibro;
}
