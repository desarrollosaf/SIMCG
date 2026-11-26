import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
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
  @IsIn(['nombre', 'curp', 'dependencia'])
  ordenar?: 'nombre' | 'curp' | 'dependencia' = 'nombre';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  direccion?: 'asc' | 'desc' = 'asc';

  /** 'activos' (por defecto), 'baja' (dados de baja) o 'todos'. */
  @IsOptional()
  @IsIn(['activos', 'baja', 'todos'])
  estatus?: 'activos' | 'baja' | 'todos' = 'activos';

  /**
   * Filtra por si el último movimiento es obligado (true) o no obligado (false).
   * Solo aplica a servidores activos: con este filtro se excluyen las bajas.
   */
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsOptional()
  @IsBoolean()
  obligado?: boolean;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  dependenciaId?: number;
}
