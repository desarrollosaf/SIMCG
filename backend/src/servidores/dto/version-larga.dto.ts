import { IsBoolean } from 'class-validator';

export class VersionLargaDto {
  @IsBoolean({ message: 'Indica si presenta la versión larga' })
  presenta!: boolean;
}
