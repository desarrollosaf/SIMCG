import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { Recortar } from './normalizar';
import { DatosServidorDto } from './datos-servidor.dto';

export class ActualizarServidorDto extends DatosServidorDto {
  // Solo si se quiere cambiar el correo del usuario ligado (Declaranet).
  @Recortar()
  @IsOptional()
  @IsEmail({}, { message: 'El correo no es válido' })
  @MaxLength(191)
  email?: string;

  // Obligatorio cuando se manda email; se registra en el log.
  @Recortar()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivoCorreo?: string;
}
