import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { respuestaPdf } from '../documentos/respuestas';
import { ROLES_SIMCG } from '../roles/roles.constants';
import { DeclaracionPdfService, NOMBRE_PDF } from './declaracion-pdf.service';

// Como el middleware roleConsulta del sistema anterior: Consulta, Administrador,
// Estadistica y Estadistica2 (el rol Registro no abre estos PDF).
const ROLES_PDF = ROLES_SIMCG.filter((rol) => rol !== 'Registro');

@Controller('servidores/:servidorId/declaraciones/:declaracionId')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ROLES_PDF)
export class DeclaracionPdfController {
  constructor(private readonly servicio: DeclaracionPdfService) {}

  /** declaracion/{id}/{declaracion_id}: declaración pública. */
  @Get('pdf')
  async publica(
    @Param('servidorId', ParseIntPipe) servidorId: number,
    @Param('declaracionId', ParseIntPipe) declaracionId: number,
  ) {
    const pdf = await this.servicio.generar(servidorId, declaracionId, false);
    return respuestaPdf(pdf, NOMBRE_PDF);
  }

  /** declaracionp/{id}/{declaracion_id}: declaración privada. */
  @Get('pdf-privada')
  async privada(
    @Param('servidorId', ParseIntPipe) servidorId: number,
    @Param('declaracionId', ParseIntPipe) declaracionId: number,
  ) {
    const pdf = await this.servicio.generar(servidorId, declaracionId, true);
    return respuestaPdf(pdf, NOMBRE_PDF);
  }
}
