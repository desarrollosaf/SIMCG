import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ROL_ADMINISTRADOR } from './roles.constants';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROL_ADMINISTRADOR)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  listRoles() {
    return this.rolesService.listRoles();
  }
}
