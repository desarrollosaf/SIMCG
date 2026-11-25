import {
  Controller,
  Get,
  Post,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { JwtAuthGuard, JwtPayload } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { ArchivoSubido } from '../common/archivo-subido';
import { ROL_ADMINISTRADOR } from '../roles/roles.constants';
import { CargasNoObligadosService } from './cargas-no-obligados.service';
import { CargasServidoresService } from './cargas-servidores.service';
import { MAX_BYTES_CSV } from './csv';

// Quienes pueden dar de alta servidores (misma regla que el alta individual).
const ALTA = [ROL_ADMINISTRADOR, 'Registro'];

const actorId = (req: Request) => (req['user'] as JwtPayload).sub;

const csv = (contenido: Buffer, nombre: string) =>
  new StreamableFile(contenido, {
    type: 'text/csv; charset=utf-8',
    disposition: `attachment; filename="${nombre}"`,
  });

const subida = () =>
  FileInterceptor('archivo', { limits: { fileSize: MAX_BYTES_CSV, files: 1 } });

@Controller('cargas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CargasController {
  constructor(
    private readonly servidores: CargasServidoresService,
    private readonly noObligados: CargasNoObligadosService,
  ) {}

  @Get('servidores/layout')
  @Roles(...ALTA)
  layoutServidores() {
    return csv(this.servidores.layout(), 'layout-servidores.csv');
  }

  @Post('servidores/previsualizar')
  @Roles(...ALTA)
  @UseInterceptors(subida())
  previsualizarServidores(@UploadedFile() archivo: ArchivoSubido | undefined) {
    return this.servidores.previsualizar(archivo);
  }

  @Post('servidores/confirmar')
  @Roles(...ALTA)
  @UseInterceptors(subida())
  confirmarServidores(
    @UploadedFile() archivo: ArchivoSubido | undefined,
    @Req() req: Request,
  ) {
    return this.servidores.confirmar(archivo, actorId(req));
  }

  @Get('no-obligados/layout')
  @Roles(ROL_ADMINISTRADOR)
  layoutNoObligados() {
    return csv(this.noObligados.layout(), 'layout-no-obligados.csv');
  }

  @Post('no-obligados/previsualizar')
  @Roles(ROL_ADMINISTRADOR)
  @UseInterceptors(subida())
  previsualizarNoObligados(@UploadedFile() archivo: ArchivoSubido | undefined) {
    return this.noObligados.previsualizar(archivo);
  }

  @Post('no-obligados/confirmar')
  @Roles(ROL_ADMINISTRADOR)
  @UseInterceptors(subida())
  confirmarNoObligados(
    @UploadedFile() archivo: ArchivoSubido | undefined,
    @Req() req: Request,
  ) {
    return this.noObligados.confirmar(archivo, actorId(req));
  }
}
