import {
  Body,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard, JwtPayload } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ROL_ADMINISTRADOR } from '../roles/roles.constants';
import { ObligadoDto } from './dto/obligado.dto';
import { MovimientosService } from './movimientos.service';

const actorId = (req: Request) => (req['user'] as JwtPayload).sub;

@Controller('movimientos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MovimientosController {
  constructor(private readonly movimientosService: MovimientosService) {}

  @Patch(':id/obligado')
  @Roles(ROL_ADMINISTRADOR, 'Registro')
  obligado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ObligadoDto,
    @Req() req: Request,
  ) {
    return this.movimientosService.cambiarObligado(
      id,
      dto.obligado,
      dto.motivoNoObligadoId,
      actorId(req),
    );
  }

  // Igual que el sistema viejo: solo Administrador y Consulta eliminan movimientos.
  @Delete(':id')
  @Roles(ROL_ADMINISTRADOR, 'Consulta')
  eliminar(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.movimientosService.eliminar(id, actorId(req));
  }
}
