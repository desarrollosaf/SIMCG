import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { MODELOS_DECLARANET, MODELOS_SERVIDORES } from '../database/models';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { LibrosController } from './libros.controller';
import { LibrosService } from './libros.service';

@Module({
  imports: [
    SequelizeModule.forFeature(MODELOS_SERVIDORES),
    SequelizeModule.forFeature(MODELOS_DECLARANET, 'declaranet'),
    JwtAuthModule,
  ],
  controllers: [LibrosController],
  providers: [LibrosService],
})
export class LibrosModule {}
