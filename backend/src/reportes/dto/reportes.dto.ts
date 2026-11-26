import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  MaxLength,
  ValidateBy,
  ValidationOptions,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Recortar } from '../../servidores/dto/normalizar';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Fecha 'YYYY-MM-DD' que existe en el calendario (rechaza 2026-02-31).
const FechaReal = (opciones?: ValidationOptions) =>
  ValidateBy(
    {
      name: 'fechaReal',
      validator: {
        validate: (valor: unknown) => {
          if (typeof valor !== 'string' || !FECHA.test(valor)) return false;
          const [a, m, d] = valor.split('-').map(Number);
          const f = new Date(Date.UTC(a, m - 1, d));
          return (
            f.getUTCFullYear() === a &&
            f.getUTCMonth() === m - 1 &&
            f.getUTCDate() === d
          );
        },
      },
    },
    opciones,
  );

export class RangoFechasDto {
  @Recortar()
  @FechaReal({ message: 'La fecha de inicio no es válida' })
  fecha_inicio!: string;

  @Recortar()
  @FechaReal({ message: 'La fecha de término no es válida' })
  fecha_fin!: string;
}

export const TIPOS_REPORTE_CORREO = ['PREVENTIVO', 'REMISION'] as const;
export type TipoReporteCorreo = (typeof TIPOS_REPORTE_CORREO)[number];

export class ReporteCorreoDto extends RangoFechasDto {
  @IsIn(TIPOS_REPORTE_CORREO, {
    message: 'El tipo debe ser PREVENTIVO o REMISION',
  })
  tipo!: TipoReporteCorreo;
}

export class IdDeclaracionDto {
  @Type(() => Number)
  @IsInt({ message: 'La declaración no es válida' })
  @Min(1, { message: 'La declaración no es válida' })
  declaracionId!: number;
}

export class OficioPreventivoDto extends IdDeclaracionDto {
  @Recortar()
  @IsString()
  @IsNotEmpty({ message: 'El oficio consecutivo es obligatorio' })
  @MaxLength(100)
  folio!: string;

  @Recortar()
  @FechaReal({ message: 'La fecha del oficio no es válida' })
  fechaOficio!: string;
}

export class OficioOmisoDto extends OficioPreventivoDto {
  @Recortar()
  @IsString()
  @IsNotEmpty({ message: 'El oficio de la DADP es obligatorio' })
  @MaxLength(150)
  folioDadp!: string;

  @Recortar()
  @FechaReal({ message: 'La fecha del padrón no es válida' })
  fechaPadron!: string;

  @Recortar()
  @IsString()
  @IsNotEmpty({ message: 'La documentación soporte es obligatoria' })
  @MaxLength(5000)
  soporte!: string;
}
