import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
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
import {
  AnioDto,
  ListarDeclaracionesLibroDto,
  SubirActaDto,
} from './dto/libros.dto';
import { LibrosService } from './libros.service';

const actorId = (req: Request) => (req['user'] as JwtPayload).sub;

// El sistema anterior no revisaba rol en libros; aquí solo el Administrador.
@Controller('libros')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROL_ADMINISTRADOR)
export class LibrosController {
  constructor(private readonly librosService: LibrosService) {}

  @Get('anios')
  @Roles(ROL_ADMINISTRADOR)
  anios() {
    return this.librosService.anios();
  }

  @Get('resumen')
  @Roles(ROL_ADMINISTRADOR)
  resumen(@Query() query: AnioDto) {
    return this.librosService.resumen(query.anio);
  }

  @Get('declaraciones')
  @Roles(ROL_ADMINISTRADOR)
  declaraciones(@Query() query: ListarDeclaracionesLibroDto) {
    return this.librosService.declaraciones(query);
  }

  @Get('actas')
  @Roles(ROL_ADMINISTRADOR)
  actas(@Query() query: AnioDto) {
    return this.librosService.actas(query.anio);
  }

  @Post('actas')
  @Roles(ROL_ADMINISTRADOR)
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: 15 * 1024 * 1024, files: 1 },
    }),
  )
  subirActa(
    @Body() dto: SubirActaDto,
    @UploadedFile() archivo: ArchivoSubido | undefined,
    @Req() req: Request,
  ) {
    return this.librosService.subirActa(dto, archivo, actorId(req));
  }

  @Get('actas/:id/acta')
  @Roles(ROL_ADMINISTRADOR)
  acta(@Param('id', ParseIntPipe) id: number) {
    return this.librosService.descargar(id, 'acta');
  }

  @Get('actas/:id/soporte')
  @Roles(ROL_ADMINISTRADOR)
  soporte(@Param('id', ParseIntPipe) id: number) {
    return this.librosService.descargar(id, 'soporte');
  }
}
