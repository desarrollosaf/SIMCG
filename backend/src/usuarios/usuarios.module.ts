import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { MODELOS_ACCESO } from '../database/models';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

@Module({
  imports: [SequelizeModule.forFeature(MODELOS_ACCESO), JwtAuthModule],
  controllers: [UsuariosController],
  providers: [UsuariosService],
})
export class UsuariosModule {}
