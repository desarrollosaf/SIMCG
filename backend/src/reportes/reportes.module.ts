import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { MODELOS_DECLARANET, MODELOS_SERVIDORES } from '../database/models';
import { OficiosService } from './oficios.service';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';

@Module({
  imports: [
    SequelizeModule.forFeature(MODELOS_SERVIDORES),
    SequelizeModule.forFeature(MODELOS_DECLARANET, 'declaranet'),
    JwtAuthModule,
  ],
  controllers: [ReportesController],
  providers: [ReportesService, OficiosService],
  exports: [ReportesService],
})
export class ReportesModule {}
