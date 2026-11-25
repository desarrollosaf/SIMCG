import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class ObligadoDto {
  @IsBoolean({ message: 'Indica si el servidor está obligado' })
  obligado!: boolean;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  motivoNoObligadoId?: number;
}
