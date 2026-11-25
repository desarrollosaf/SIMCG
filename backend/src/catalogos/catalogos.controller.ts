import {
  Controller,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ROLES_SIMCG } from '../roles/roles.constants';
import { CatalogosService } from './catalogos.service';

@Controller('catalogos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ROLES_SIMCG)
export class CatalogosController {
  constructor(private readonly catalogosService: CatalogosService) {}

  @Get('dependencias')
  dependencias() {
    return this.catalogosService.dependencias();
  }

  @Get('direcciones')
  direcciones(
    @Query('dependencia', new ParseIntPipe({ optional: true }))
    dependencia?: number,
  ) {
    return this.catalogosService.direcciones(dependencia);
  }

  @Get('departamentos')
  departamentos(
    @Query('direccion', new ParseIntPipe({ optional: true }))
    direccion?: number,
  ) {
    return this.catalogosService.departamentos(direccion);
  }

  @Get('tipos-movimiento')
  tiposMovimiento() {
    return this.catalogosService.tiposMovimiento();
  }

  @Get('respuestas')
  respuestas() {
    return this.catalogosService.respuestas();
  }

  @Get('motivos-no-obligado')
  motivosNoObligado() {
    return this.catalogosService.motivosNoObligado();
  }
}
