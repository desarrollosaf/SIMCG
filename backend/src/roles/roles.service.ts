import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Rol } from '../database/models/rol.model';
import { Permiso } from '../database/models/permiso.model';

@Injectable()
export class RolesService {
  constructor(@InjectModel(Rol) private readonly rolModel: typeof Rol) {}

  async listRoles() {
    const roles = await this.rolModel.findAll({
      include: [{ model: Permiso, through: { attributes: [] } }],
      order: [['id', 'ASC']],
    });

    return roles.map((rol) => ({
      id: rol.id,
      nombre: rol.name,
      descripcion: rol.description,
      permisos: (rol.permisos ?? []).map((p) => ({
        id: p.id,
        nombre: p.name,
        descripcion: p.description,
        ruta: p.ruta,
      })),
    }));
  }
}
