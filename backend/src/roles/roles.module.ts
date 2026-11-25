import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { MODELOS_ACCESO } from '../database/models';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({
  imports: [SequelizeModule.forFeature(MODELOS_ACCESO), JwtAuthModule],
  controllers: [RolesController],
  providers: [RolesService],
})
export class RolesModule {}
