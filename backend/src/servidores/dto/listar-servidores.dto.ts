import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Recortar } from './normalizar';

export class ListarServidoresDto {
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

  @Recortar()
  @IsOptional()
  @IsString()
  buscar?: string;

  @IsOptional()
  @IsIn(['nombre', 'curp'])
  ordenar?: 'nombre' | 'curp' = 'nombre';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  direccion?: 'asc' | 'desc' = 'asc';
}
