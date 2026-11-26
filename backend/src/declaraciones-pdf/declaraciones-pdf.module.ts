import { Module } from '@nestjs/common';
import { JwtAuthModule } from '../auth/jwt-auth.module';
import { DeclaracionPdfController } from './declaracion-pdf.controller';
import { DeclaracionPdfService } from './declaracion-pdf.service';
import { CargadorEloquent } from './eloquent/cargador';

@Module({
  imports: [JwtAuthModule],
  controllers: [DeclaracionPdfController],
  providers: [CargadorEloquent, DeclaracionPdfService],
  exports: [DeclaracionPdfService],
})
export class DeclaracionesPdfModule {}
