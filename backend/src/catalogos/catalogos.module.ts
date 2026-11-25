import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { MODELOS_DECLARANET, MODELOS_SERVIDORES } from '../database/models';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { CatalogosController } from './catalogos.controller';
import { CatalogosService } from './catalogos.service';

@Module({
  imports: [
    SequelizeModule.forFeature(MODELOS_SERVIDORES),
    SequelizeModule.forFeature(MODELOS_DECLARANET, 'declaranet'),
    JwtAuthModule,
  ],
  controllers: [CatalogosController],
  providers: [CatalogosService],
})
export class CatalogosModule {}
