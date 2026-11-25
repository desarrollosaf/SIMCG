import { Type } from 'class-transformer';
import { IsInt, IsString, Matches, Min } from 'class-validator';
import { DatosServidorDto, REGEX_FECHA } from './datos-servidor.dto';

export class CrearServidorDto extends DatosServidorDto {
  @IsString()
  @Matches(REGEX_FECHA, { message: 'La fecha de inicio no es válida' })
  fechaInicio!: string;

  @Type(() => Number)
  @IsInt({ message: 'Selecciona el tipo de movimiento' })
  @Min(1, { message: 'Selecciona el tipo de movimiento' })
  tipoMovimientoId!: number;

  @IsString()
  @Matches(REGEX_FECHA, { message: 'La fecha del movimiento no es válida' })
  fechaDeclaracion!: string;
}
