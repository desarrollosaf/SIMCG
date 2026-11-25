import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes, Transaction } from 'sequelize';
import { User } from '../database/models/user.model';
import { ServidorPublico } from '../database/models/servidor-publico.model';
import { TipoDependencia } from '../database/models/tipo-dependencia.model';
import {
  MODEL_TYPE_USER,
  ModelHasRole,
} from '../database/models/model-has-role.model';
import { Rol } from '../database/models/rol.model';
import { Folio } from '../database/models/folio.model';
import { ROLES_SIMCG } from '../roles/roles.constants';
import { AccesoDto } from './dto/acceso.dto';

const TIPO_OFICIO_ROLE = 1;

@Injectable()
export class UsuariosService {
  constructor(
    @InjectConnection() private readonly sequelize: Sequelize,
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(ServidorPublico)
    private readonly servidorModel: typeof ServidorPublico,
    @InjectModel(ModelHasRole)
    private readonly modelHasRoleModel: typeof ModelHasRole,
    @InjectModel(Rol) private readonly rolModel: typeof Rol,
    @InjectModel(Folio) private readonly folioModel: typeof Folio,
  ) {}

  async listar() {
    const asignaciones = await this.modelHasRoleModel.findAll({
      where: { modelType: MODEL_TYPE_USER },
      include: [{ model: Rol, where: { name: [...ROLES_SIMCG] } }],
    });
    const ids = [...new Set(asignaciones.map((a) => a.modelId))];
    if (ids.length === 0) return [];

    const users = await this.userModel.findAll({
      where: { id: ids },
      include: [this.incluirServidor()],
    });
    const rolesPorUsuario = new Map<number, string[]>();
    for (const a of asignaciones) {
      const roles = rolesPorUsuario.get(a.modelId) ?? [];
      roles.push(a.rol.name);
      rolesPorUsuario.set(a.modelId, roles);
    }

    return users
      .map((u) => this.armarFila(u, rolesPorUsuario.get(u.id) ?? []))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  // TODO Fase 4: generar la ficha PDF del acceso otorgado.
  async darAcceso(dto: AccesoDto, actorId: number) {
    const userId = await this.sequelize.transaction(async (transaction) => {
      const servidor = await this.servidorModel.findOne({
        where: { rfc: dto.rfc, curp: dto.curp, homoclave: dto.homoclave },
        transaction,
      });
      if (!servidor) {
        throw new NotFoundException('No existe registro del servidor público');
      }

      const user = await this.userModel.findOne({
        where: { servidorPublicoId: servidor.id },
        order: [['id', 'ASC']],
        transaction,
      });
      if (!user) {
        throw new NotFoundException(
          'El servidor público no tiene usuario en Declaranet',
        );
      }

      if (user.id === actorId) {
        throw new BadRequestException('No puedes cambiar tu propio rol');
      }

      const rol = await this.rolModel.findOne({
        where: { name: dto.rol, guardName: 'web' },
        transaction,
      });
      if (!rol) {
        throw new BadRequestException('El rol no es válido');
      }

      await user.update({ verificacion: true }, { transaction });
      // Un solo rol por usuario: se reemplazan los que tuviera.
      await this.modelHasRoleModel.destroy({
        where: { modelType: MODEL_TYPE_USER, modelId: user.id },
        transaction,
      });
      await this.modelHasRoleModel.create(
        { roleId: rol.id, modelType: MODEL_TYPE_USER, modelId: user.id },
        { transaction },
      );

      const noFolio = await this.siguienteFolio(transaction);
      await this.folioModel.create(
        {
          foliosableId: user.id,
          foliosableType: MODEL_TYPE_USER,
          noFolio: String(noFolio),
          tipoOficioId: TIPO_OFICIO_ROLE,
        },
        { transaction },
      );

      return user.id;
    });

    const user = await this.userModel.findByPk(userId, {
      include: [this.incluirServidor()],
    });
    return this.armarFila(user!, [dto.rol]);
  }

  async baja(id: number, actorId: number) {
    if (id === actorId) {
      throw new BadRequestException('No puedes darte de baja a ti mismo');
    }

    await this.sequelize.transaction(async (transaction) => {
      const user = await this.userModel.findByPk(id, { transaction });
      if (!user) {
        throw new NotFoundException('Usuario no encontrado');
      }
      await user.update({ verificacion: false }, { transaction });
      await this.modelHasRoleModel.destroy({
        where: { modelType: MODEL_TYPE_USER, modelId: id },
        transaction,
      });
    });

    return { mensaje: 'Usuario dado de baja' };
  }

  // La columna no_folio es varchar: se compara como número y se bloquea la
  // lectura para que dos altas simultáneas no repitan consecutivo.
  private async siguienteFolio(transaction: Transaction): Promise<number> {
    const [fila] = await this.sequelize.query<{ maximo: string | null }>(
      'SELECT MAX(CAST(no_folio AS UNSIGNED)) AS maximo FROM folios FOR UPDATE',
      { type: QueryTypes.SELECT, transaction },
    );
    return Number(fila?.maximo ?? 0) + 1;
  }

  private incluirServidor() {
    return {
      model: ServidorPublico,
      paranoid: false,
      include: [{ model: TipoDependencia, paranoid: false }],
    };
  }

  private armarFila(user: User, roles: string[]) {
    const s = user.servidor;
    return {
      id: user.id,
      nombre: s
        ? [s.nombre, s.primerApellido, s.segundoApellido]
            .filter(Boolean)
            .join(' ')
        : user.name,
      curp: s?.curp ?? null,
      dependencia: s?.dependencia?.nombre ?? null,
      email: user.email,
      roles,
      verificacion: !!user.verificacion,
    };
  }
}
