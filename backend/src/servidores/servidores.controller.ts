import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard, JwtPayload } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ROL_ADMINISTRADOR, ROLES_SIMCG } from '../roles/roles.constants';
import { ActualizarServidorDto } from './dto/actualizar-servidor.dto';
import { BajaServidorDto } from './dto/baja-servidor.dto';
import { CrearMovimientoDto } from './dto/crear-movimiento.dto';
import { CrearServidorDto } from './dto/crear-servidor.dto';
import { ListarServidoresDto } from './dto/listar-servidores.dto';
import { VersionLargaDto } from './dto/version-larga.dto';
import { MovimientosService } from './movimientos.service';
import { ServidoresService } from './servidores.service';

// Quienes pueden dar de alta, editar y dar de baja servidores y sus movimientos.
const ESCRITURA = [ROL_ADMINISTRADOR, 'Registro'];

const actorId = (req: Request) => (req['user'] as JwtPayload).sub;

@Controller('servidores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ROLES_SIMCG)
export class ServidoresController {
  constructor(
    private readonly servidoresService: ServidoresService,
    private readonly movimientosService: MovimientosService,
  ) {}

  @Get()
  listar(@Query() query: ListarServidoresDto) {
    return this.servidoresService.listar(query);
  }

  @Get(':id')
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.servidoresService.detalle(id);
  }

  @Post()
  @Roles(...ESCRITURA)
  crear(@Body() dto: CrearServidorDto, @Req() req: Request) {
    return this.servidoresService.crear(dto, actorId(req));
  }

  @Put(':id')
  @Roles(...ESCRITURA)
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarServidorDto,
    @Req() req: Request,
  ) {
    return this.servidoresService.actualizar(id, dto, actorId(req));
  }

  @Delete(':id')
  @Roles(...ESCRITURA)
  baja(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BajaServidorDto,
    @Req() req: Request,
  ) {
    return this.servidoresService.baja(id, dto.motivo, actorId(req));
  }

  @Patch(':id/version-larga')
  @Roles(...ESCRITURA)
  versionLarga(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VersionLargaDto,
    @Req() req: Request,
  ) {
    return this.servidoresService.cambiarVersionLarga(
      id,
      dto.presenta,
      actorId(req),
    );
  }

  @Get(':id/movimientos')
  historial(@Param('id', ParseIntPipe) id: number) {
    return this.movimientosService.historial(id);
  }

  @Get(':id/movimientos/permitidos')
  permitidos(@Param('id', ParseIntPipe) id: number) {
    return this.movimientosService.permitidos(id);
  }

  @Post(':id/movimientos')
  @Roles(...ESCRITURA)
  crearMovimiento(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CrearMovimientoDto,
    @Req() req: Request,
  ) {
    return this.movimientosService.crear(
      id,
      dto.tipoMovimientoId,
      actorId(req),
    );
  }
}
