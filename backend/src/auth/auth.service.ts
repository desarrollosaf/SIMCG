import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes } from 'sequelize';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '../database/models/user.model';
import { ServidorPublico } from '../database/models/servidor-publico.model';
import {
  MODEL_TYPE_USER,
  ModelHasRole,
} from '../database/models/model-has-role.model';
import { Rol } from '../database/models/rol.model';

const CREDENCIALES_INVALIDAS = 'Credenciales inválidas';
const SESION_NO_VALIDA = 'Sesión no válida';
// Hash de relleno para que el tiempo de respuesta no revele si el correo existe.
const HASH_RELLENO =
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

@Injectable()
export class AuthService {
  constructor(
    @InjectConnection() private readonly sequelize: Sequelize,
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(ModelHasRole)
    private readonly modelHasRoleModel: typeof ModelHasRole,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.cargarUsuario({ email: email.trim() });

    // Laravel guarda los hashes como $2y$; bcryptjs los entiende como $2b$.
    const hash = user?.password.replace(/^\$2y\$/, '$2b$') ?? HASH_RELLENO;
    const passwordValida = await bcrypt.compare(password, hash);
    if (!user || !passwordValida) {
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }

    const roles = await this.rolesDe(user.id);
    if (!user.verificacion || roles.length === 0) {
      throw new UnauthorizedException(CREDENCIALES_INVALIDAS);
    }

    const payload = { sub: user.id, email: user.email, roles };
    const token = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('auth.jwtSecret'),
      expiresIn: this.configService.get<number>('auth.jwtExpiresInSeconds'),
    });

    return { token, usuario: this.armarUsuario(user, roles) };
  }

  async perfil(id: number) {
    const roles = await this.sesionVigente(id);
    const user = await this.cargarUsuario({ id });
    if (!user) {
      throw new UnauthorizedException(SESION_NO_VALIDA);
    }
    return this.armarUsuario(user, roles);
  }

  // Una sola consulta: el usuario debe existir, estar verificado y tener rol.
  // Devuelve los roles actuales de la BD; si no, 401.
  async sesionVigente(id: number): Promise<string[]> {
    const filas = await this.sequelize.query<{ nombre: string }>(
      `SELECT r.name AS nombre
         FROM users u
         JOIN model_has_roles m ON m.model_id = u.id AND m.model_type = :tipo
         JOIN roles r ON r.id = m.role_id
        WHERE u.id = :id AND u.verificacion = 1`,
      {
        replacements: { id, tipo: MODEL_TYPE_USER },
        type: QueryTypes.SELECT,
      },
    );
    if (filas.length === 0) {
      throw new UnauthorizedException(SESION_NO_VALIDA);
    }
    return filas.map((f) => f.nombre);
  }

  private cargarUsuario(where: { id: number } | { email: string }) {
    return this.userModel.findOne({
      where,
      include: [{ model: ServidorPublico, paranoid: false }],
    });
  }

  private async rolesDe(userId: number): Promise<string[]> {
    const asignaciones = await this.modelHasRoleModel.findAll({
      where: { modelType: MODEL_TYPE_USER, modelId: userId },
      include: [{ model: Rol }],
    });
    return asignaciones.map((a) => a.rol.name);
  }

  private armarUsuario(user: User, roles: string[]) {
    const s = user.servidor;
    const nombre = s
      ? [s.nombre, s.primerApellido, s.segundoApellido]
          .filter(Boolean)
          .join(' ')
      : user.name;
    return { id: user.id, nombre, email: user.email, roles };
  }
}
