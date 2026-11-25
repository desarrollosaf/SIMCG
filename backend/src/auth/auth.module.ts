import { Module } from '@nestjs/common';
import { JwtAuthModule } from './jwt-auth.module';
import { AuthController } from './auth.controller';

@Module({
  imports: [JwtAuthModule],
  controllers: [AuthController],
  exports: [JwtAuthModule],
})
export class AuthModule {}
