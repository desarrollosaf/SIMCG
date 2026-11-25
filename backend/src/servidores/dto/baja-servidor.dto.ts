import { IsString, Length } from 'class-validator';
import { Recortar } from './normalizar';

export class BajaServidorDto {
  @Recortar()
  @IsString({ message: 'El motivo de la baja es obligatorio' })
  @Length(5, 500, {
    message: 'El motivo de la baja debe tener entre 5 y 500 caracteres',
  })
  motivo!: string;
}
