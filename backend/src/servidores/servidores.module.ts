import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { MODELOS_DECLARANET, MODELOS_SERVIDORES } from '../database/models';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { MovimientosController } from './movimientos.controller';
import { MovimientosService } from './movimientos.service';
import { ServidoresController } from './servidores.controller';
import { ServidoresService } from './servidores.service';

@Module({
  imports: [
    SequelizeModule.forFeature(MODELOS_SERVIDORES),
    SequelizeModule.forFeature(MODELOS_DECLARANET, 'declaranet'),
    JwtAuthModule,
  ],
  controllers: [ServidoresController, MovimientosController],
  providers: [ServidoresService, MovimientosService],
  exports: [ServidoresService],
})
export class ServidoresModule {}
