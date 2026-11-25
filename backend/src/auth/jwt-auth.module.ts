import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { SequelizeModule } from '@nestjs/sequelize';
import { MODELOS_ACCESO } from '../database/models';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    SequelizeModule.forFeature(MODELOS_ACCESO),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('auth.jwtSecret'),
        signOptions: {
          expiresIn: config.get<number>('auth.jwtExpiresInSeconds'),
        },
      }),
    }),
  ],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  exports: [JwtModule, AuthService, JwtAuthGuard, RolesGuard],
})
export class JwtAuthModule {}
