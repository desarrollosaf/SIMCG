import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Recortar } from './normalizar';
import { DatosServidorDto } from './datos-servidor.dto';

export class ActualizarServidorDto extends DatosServidorDto {
  // Solo si se quiere cambiar el correo del usuario ligado (Declaranet).
  @Recortar()
  @IsOptional()
  @IsEmail({}, { message: 'El correo no es válido' })
  @MaxLength(191)
  email?: string;

  // Motivo del cambio: el servicio lo exige siempre que haya algo que cambiar
  // y lo guarda en la bitácora junto con la lista de cambios.
  @Recortar()
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El motivo del cambio no puede ir vacío' })
  @MinLength(5, { message: 'El motivo debe tener al menos 5 caracteres' })
  @MaxLength(500, { message: 'El motivo admite máximo 500 caracteres' })
  motivo?: string;
}
