import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class CrearMovimientoDto {
  @Type(() => Number)
  @IsInt({ message: 'Selecciona el tipo de movimiento' })
  @Min(1, { message: 'Selecciona el tipo de movimiento' })
  tipoMovimientoId!: number;
}
