import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { MODELOS_DECLARANET, MODELOS_SERVIDORES } from '../database/models';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { ServidoresModule } from '../servidores/servidores.module';
import { CargasController } from './cargas.controller';
import { CargasNoObligadosService } from './cargas-no-obligados.service';
import { CargasServidoresService } from './cargas-servidores.service';

@Module({
  imports: [
    SequelizeModule.forFeature(MODELOS_SERVIDORES),
    SequelizeModule.forFeature(MODELOS_DECLARANET, 'declaranet'),
    JwtAuthModule,
    ServidoresModule,
  ],
  controllers: [CargasController],
  providers: [CargasServidoresService, CargasNoObligadosService],
})
export class CargasModule {}
