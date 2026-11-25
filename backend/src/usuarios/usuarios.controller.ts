import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard, JwtPayload } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ROL_ADMINISTRADOR } from '../roles/roles.constants';
import { AccesoDto } from './dto/acceso.dto';
import { UsuariosService } from './usuarios.service';

@Controller('usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROL_ADMINISTRADOR)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  listar() {
    return this.usuariosService.listar();
  }

  @Post('acceso')
  @HttpCode(HttpStatus.OK)
  darAcceso(@Body() dto: AccesoDto, @Req() req: Request) {
    const { sub } = req['user'] as JwtPayload;
    return this.usuariosService.darAcceso(dto, sub);
  }

  @Delete(':id')
  baja(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const { sub } = req['user'] as JwtPayload;
    return this.usuariosService.baja(id, sub);
  }
}
