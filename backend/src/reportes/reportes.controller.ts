import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard, JwtPayload } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  TIPO_CORREO_PREVENTIVO,
  TIPO_CORREO_REMISION,
} from '../database/models/envio-correo.model';
import { respuestaExcel, respuestaPdf } from '../documentos/respuestas';
import { ROLES_SIMCG } from '../roles/roles.constants';
import {
  OficioOmisoDto,
  OficioPreventivoDto,
  RangoFechasDto,
  ReporteCorreoDto,
} from './dto/reportes.dto';
import { OficiosService } from './oficios.service';
import { ReportesService } from './reportes.service';

const usuarioId = (req: Request) => (req['user'] as JwtPayload).sub;

// Como en el sistema viejo: Consulta, Administrador, Estadistica y Estadistica2.
export const ROLES_REPORTES = ROLES_SIMCG.filter((rol) => rol !== 'Registro');

@Controller('reportes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ROLES_REPORTES)
export class ReportesController {
  constructor(
    private readonly reportes: ReportesService,
    private readonly oficios: OficiosService,
  ) {}

  @Get('omisos')
  omisos(@Query() query: RangoFechasDto) {
    return this.reportes.omisos(query.fecha_inicio, query.fecha_fin);
  }

  @Get('preventivos')
  preventivos() {
    return this.reportes.preventivos();
  }

  @Get('omisos/:declaracionId/oficio-previo')
  oficioPrevioOmiso(@Param('declaracionId', ParseIntPipe) id: number) {
    return this.oficios.oficioPrevio(id, TIPO_CORREO_REMISION);
  }

  @Get('preventivos/:declaracionId/oficio-previo')
  oficioPrevioPreventivo(@Param('declaracionId', ParseIntPipe) id: number) {
    return this.oficios.oficioPrevio(id, TIPO_CORREO_PREVENTIVO);
  }

  @Post('omisos/oficio')
  async oficioOmiso(@Body() dto: OficioOmisoDto, @Req() req: Request) {
    const pdf = await this.oficios.generarRemision(dto, usuarioId(req));
    return respuestaPdf(pdf.buffer, pdf.nombre);
  }

  @Post('preventivos/oficio')
  async oficioPreventivo(
    @Body() dto: OficioPreventivoDto,
    @Req() req: Request,
  ) {
    const pdf = await this.oficios.generarPreventivo(dto, usuarioId(req));
    return respuestaPdf(pdf.buffer, pdf.nombre);
  }

  @Post('preventivos/:declaracionId/correo')
  async correoPreventivo(
    @Param('declaracionId', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    await this.oficios.enviarCorreoPreventivo(id, usuarioId(req));
    return { ok: true };
  }

  @Get('correos/excel')
  async correosExcel(@Query() query: ReporteCorreoDto) {
    const buffer = await this.reportes.excelCorreos(
      query.tipo,
      query.fecha_inicio,
      query.fecha_fin,
    );
    return respuestaExcel(buffer, 'correo.xlsx');
  }
}
