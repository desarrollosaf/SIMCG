import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op, Transaction, WhereOptions, literal } from 'sequelize';
import {
  Declaracion,
  ESTATUS_DECLARACION_INICIAL,
} from '../database/models/declaracion.model';
import { Respuesta } from '../database/models/respuesta.model';
import { ServidorPublico } from '../database/models/servidor-publico.model';
import { TipoDepartamento } from '../database/models/tipo-departamento.model';
import { TipoDependencia } from '../database/models/tipo-dependencia.model';
import { TipoDireccion } from '../database/models/tipo-direccion.model';
import {
  TIPO_MOV_INTERESES,
  TipoMovimientoMcg,
} from '../database/models/tipo-movimiento-mcg.model';
import { User } from '../database/models/user.model';
import { ActualizarServidorDto } from './dto/actualizar-servidor.dto';
import { CrearServidorDto } from './dto/crear-servidor.dto';
import { DatosServidorDto } from './dto/datos-servidor.dto';
import { ListarServidoresDto } from './dto/listar-servidores.dto';
import { permiteVersionLarga } from './movimientos.reglas';

const nombreCompleto = (s: ServidorPublico): string =>
  [s.nombre, s.primerApellido, s.segundoApellido].filter(Boolean).join(' ');

// Escapa los comodines de LIKE para que la búsqueda sea literal.
const escaparLike = (texto: string): string =>
  texto.replace(/[\\%_]/g, (c) => `\\${c}`);

@Injectable()
export class ServidoresService {
  private readonly logger = new Logger(ServidoresService.name);

  constructor(
    @InjectConnection() private readonly sequelize: Sequelize,
    @InjectModel(ServidorPublico)
    private readonly servidorModel: typeof ServidorPublico,
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(TipoDependencia)
    private readonly dependenciaModel: typeof TipoDependencia,
    @InjectModel(TipoDireccion)
    private readonly direccionModel: typeof TipoDireccion,
    @InjectModel(TipoDepartamento)
    private readonly departamentoModel: typeof TipoDepartamento,
    @InjectModel(TipoMovimientoMcg)
    private readonly tipoMovimientoModel: typeof TipoMovimientoMcg,
    @InjectModel(Respuesta) private readonly respuestaModel: typeof Respuesta,
    @InjectModel(Declaracion, 'declaranet')
    private readonly declaracionModel: typeof Declaracion,
  ) {}

  async listar(dto: ListarServidoresDto) {
    const palabras = (dto.buscar ?? '').split(/\s+/).filter(Boolean);

    // Cada palabra debe aparecer en algún campo (no necesariamente el mismo).
    const where: WhereOptions = palabras.length
      ? {
          [Op.and]: palabras.map((palabra) => {
            const like = { [Op.like]: `%${escaparLike(palabra)}%` };
            return {
              [Op.or]: [
                { nombre: like },
                { primerApellido: like },
                { segundoApellido: like },
                { curp: like },
                { '$dependencia.nombre$': like },
                { '$direccion.nombre$': like },
              ],
            };
          }),
        }
      : {};

    const sentido = dto.direccion === 'desc' ? 'DESC' : 'ASC';
    const orden =
      dto.ordenar === 'curp'
        ? literal(`\`ServidorPublico\`.\`curp\` ${sentido}`)
        : literal(
            `CONCAT_WS(' ', \`ServidorPublico\`.\`nombre\`, \`ServidorPublico\`.\`primer_apellido\`, \`ServidorPublico\`.\`segundo_apellido\`) ${sentido}`,
          );

    const { count, rows } = await this.servidorModel.findAndCountAll({
      where,
      include: [
        { model: TipoDependencia, as: 'dependencia', paranoid: false },
        { model: TipoDireccion, as: 'direccion', paranoid: false },
      ],
      order: [orden, ['id', 'ASC']],
      offset: dto.inicio ?? 0,
      limit: dto.limite ?? 10,
      subQuery: false,
    });

    return {
      total: count,
      filas: rows.map((s) => ({
        id: s.id,
        nombre: nombreCompleto(s),
        curp: s.curp,
        dependencia: s.dependencia?.nombre ?? null,
        direccion: s.direccion?.nombre ?? null,
      })),
    };
  }

  async detalle(id: number) {
    const servidor = await this.buscarServidor(id);
    const usuario = await this.userModel.findOne({
      where: { servidorPublicoId: id },
      order: [['id', 'ASC']],
    });

    return {
      id: servidor.id,
      nombre: servidor.nombre,
      primerApellido: servidor.primerApellido,
      segundoApellido: servidor.segundoApellido,
      rfc: servidor.rfc?.trim() ?? null,
      homoclave: servidor.homoclave?.trim() ?? null,
      curp: servidor.curp?.trim() ?? null,
      fechaInicio: servidor.fechaInicio,
      cargo: servidor.cargo.trim(),
      // Los datos viejos traen espacios sobrantes (ej. ' 03-1 ').
      nivelCargo: servidor.nivelCargo.trim(),
      cveIssemym: servidor.cveIssemym,
      tipoDependenciaId: servidor.tipoDependenciaId,
      tipoDireccionId: servidor.tipoDireccionId,
      tipoDepartamentoId: servidor.tipoDepartamentoId,
      honorarios: servidor.honorarios,
      presentaVersionLarga: !!servidor.presentaVersionLarga,
      puedeVersionLarga: permiteVersionLarga(servidor.nivelCargo),
      email: usuario?.email ?? null,
    };
  }

  /**
   * Alta del servidor y de su movimiento inicial. Las dos tablas viven en bases
   * distintas (cddiputados y declaranet) y no pueden compartir transacción, así
   * que: se abre la transacción en cddiputados, se inserta el servidor (sin
   * confirmar), se inserta la declaración en declaranet y solo entonces se
   * confirma. Si algo falla antes del commit se hace rollback del servidor; si
   * falla el commit, se borra la declaración ya creada (compensación).
   */
  async crear(dto: CrearServidorDto, actorId: number) {
    await this.validarAlta(dto);

    const transaction = await this.sequelize.transaction();
    let declaracion: Declaracion | null = null;
    try {
      // Se repite dentro de la transacción para acortar la ventana de carrera.
      await this.validarDuplicados(dto, undefined, transaction);

      const servidor = await this.servidorModel.create(
        this.atributos(dto, { fechaInicio: dto.fechaInicio }),
        { transaction },
      );

      declaracion = await this.declaracionModel.create({
        servidorPublicoId: servidor.id,
        tipoMovimientoId: dto.tipoMovimientoId,
        fechaDeclaracion: dto.fechaDeclaracion,
        estatusDeclaracionId: ESTATUS_DECLARACION_INICIAL,
        honorarios: dto.honorarios,
        cargo: dto.cargo,
        nivelCargo: dto.nivelCargo,
      });

      await transaction.commit();
      this.logger.log(
        `Servidor ${servidor.id} dado de alta por el usuario ${actorId}`,
      );
      return this.detalle(servidor.id);
    } catch (error) {
      await transaction.rollback().catch(() => undefined);
      if (declaracion) {
        // Compensación: la declaración ya está en declaranet y el servidor no.
        await declaracion
          .destroy({ force: true })
          .catch((e: unknown) =>
            this.logger.error(
              `No se pudo borrar la declaración ${declaracion?.id} huérfana: ${String(e)}`,
            ),
          );
      }
      throw error;
    }
  }

  /**
   * Validaciones de base de datos del alta (adscripción, honorarios y tipo de
   * movimiento). Las reutiliza la carga masiva para aplicar exactamente las
   * mismas reglas que el alta individual.
   */
  async validarAlta(dto: CrearServidorDto): Promise<void> {
    await this.validarAdscripcion(dto);
    await this.validarHonorarios(dto.honorarios);
    await this.validarTipoMovimiento(dto.tipoMovimientoId);
  }

  async actualizar(id: number, dto: ActualizarServidorDto, actorId: number) {
    const servidor = await this.buscarServidor(id);
    await this.validarAdscripcion(dto);
    await this.validarHonorarios(dto.honorarios);
    await this.validarDuplicados(dto, id);

    const cambiaCorreo = dto.email !== undefined && dto.email !== '';
    if (cambiaCorreo && !dto.motivoCorreo) {
      throw new BadRequestException(
        'El motivo del cambio de correo es obligatorio',
      );
    }

    await this.sequelize.transaction(async (transaction) => {
      await servidor.update(this.atributos(dto), { transaction });

      if (cambiaCorreo) {
        const usuario = await this.userModel.findOne({
          where: { servidorPublicoId: id },
          order: [['id', 'ASC']],
          transaction,
        });
        if (!usuario) {
          throw new BadRequestException(
            'El servidor público no tiene usuario en Declaranet',
          );
        }
        const email = dto.email!;
        const repetido = await this.userModel.findOne({
          where: { email, id: { [Op.ne]: usuario.id } },
          transaction,
        });
        if (repetido) {
          throw new ConflictException('Ese correo ya está en uso');
        }
        await usuario.update({ email }, { transaction });
        await servidor.update({ cPersonal: email }, { transaction });
        // TODO Fase 5 (auditoría): guardar en la bitácora en lugar del log.
        this.logger.log(
          `Usuario ${actorId} cambió el correo del servidor ${id}. Motivo: ${dto.motivoCorreo}`,
        );
      }
    });

    return this.detalle(id);
  }

  async baja(id: number, motivo: string, actorId: number) {
    const servidor = await this.buscarServidor(id);

    const usuario = await this.userModel.findOne({
      where: { servidorPublicoId: id },
    });
    if (usuario?.id === actorId) {
      throw new BadRequestException('No puedes darte de baja a ti mismo');
    }

    await servidor.destroy();
    // TODO Fase 5 (auditoría): guardar en la bitácora en lugar del log.
    this.logger.log(
      `Usuario ${actorId} dio de baja al servidor ${id}. Motivo: ${motivo}`,
    );
    return { mensaje: 'Servidor público dado de baja' };
  }

  async cambiarVersionLarga(id: number, presenta: boolean, actorId: number) {
    const servidor = await this.buscarServidor(id);

    if (presenta && !permiteVersionLarga(servidor.nivelCargo)) {
      throw new BadRequestException(
        'El nivel del cargo no permite presentar la declaración completa',
      );
    }

    await servidor.update({ presentaVersionLarga: presenta });
    this.logger.log(
      `Usuario ${actorId} puso presenta_version_larga=${presenta} al servidor ${id}`,
    );
    return { presentaVersionLarga: presenta };
  }

  async buscarServidor(id: number): Promise<ServidorPublico> {
    const servidor = await this.servidorModel.findByPk(id);
    if (!servidor) {
      throw new NotFoundException('Servidor público no encontrado');
    }
    return servidor;
  }

  atributos(dto: DatosServidorDto, extra: Partial<ServidorPublico> = {}) {
    return {
      nombre: dto.nombre,
      primerApellido: dto.primerApellido,
      segundoApellido: dto.segundoApellido ?? null,
      rfc: dto.rfc,
      homoclave: dto.homoclave,
      curp: dto.curp,
      cargo: dto.cargo,
      nivelCargo: dto.nivelCargo,
      cveIssemym: dto.cveIssemym ?? null,
      tipoDependenciaId: dto.tipoDependenciaId,
      tipoDireccionId: dto.tipoDireccionId ?? null,
      tipoDepartamentoId: dto.tipoDepartamentoId ?? null,
      honorarios: dto.honorarios,
      ...extra,
    };
  }

  async validarDuplicados(
    dto: DatosServidorDto,
    excluirId?: number,
    transaction?: Transaction,
  ) {
    const otroId = excluirId ? { id: { [Op.ne]: excluirId } } : {};
    const repetido = await this.servidorModel.findOne({
      where: {
        ...otroId,
        [Op.or]: [
          { curp: dto.curp },
          { rfc: dto.rfc, homoclave: dto.homoclave },
        ],
      },
      transaction,
    });
    if (repetido) {
      throw new ConflictException(
        repetido.curp === dto.curp
          ? 'Ya existe un servidor público con esa CURP'
          : 'Ya existe un servidor público con ese RFC y homoclave',
      );
    }
  }

  // La dirección debe pertenecer a la dependencia y el departamento a la dirección.
  private async validarAdscripcion(dto: DatosServidorDto) {
    const dependencia = await this.dependenciaModel.findByPk(
      dto.tipoDependenciaId,
    );
    if (!dependencia) {
      throw new BadRequestException('La dependencia no existe');
    }

    if (dto.tipoDepartamentoId && !dto.tipoDireccionId) {
      throw new BadRequestException('Selecciona la dirección del departamento');
    }

    if (dto.tipoDireccionId) {
      const direccion = await this.direccionModel.findByPk(dto.tipoDireccionId);
      if (!direccion || direccion.dependenciaId !== dto.tipoDependenciaId) {
        throw new BadRequestException(
          'La dirección no pertenece a la dependencia',
        );
      }
    }

    if (dto.tipoDepartamentoId) {
      const departamento = await this.departamentoModel.findByPk(
        dto.tipoDepartamentoId,
      );
      if (
        !departamento ||
        departamento.dependenciaId !== dto.tipoDependenciaId ||
        departamento.direccionId !== dto.tipoDireccionId
      ) {
        throw new BadRequestException(
          'El departamento no pertenece a la dirección',
        );
      }
    }
  }

  private async validarHonorarios(respuestaId: number) {
    if (!(await this.respuestaModel.findByPk(respuestaId))) {
      throw new BadRequestException('La respuesta de honorarios no es válida');
    }
  }

  private async validarTipoMovimiento(tipoId: number) {
    const tipo =
      tipoId === TIPO_MOV_INTERESES
        ? null
        : await this.tipoMovimientoModel.findByPk(tipoId);
    if (!tipo) {
      throw new BadRequestException('El tipo de movimiento no es válido');
    }
  }
}
