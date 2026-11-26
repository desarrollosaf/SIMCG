import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op, QueryTypes, Transaction, WhereOptions, literal } from 'sequelize';
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
import { BitacoraService } from './bitacora.service';
import { Cambio, Valores, calcularCambios } from './servidores.cambios';
import { permiteVersionLarga } from './movimientos.reglas';

export type EstatusServidor =
  'obligado' | 'no_obligado' | 'baja' | 'sin_movimiento';

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
    private readonly bitacora: BitacoraService,
  ) {}

  async listar(dto: ListarServidoresDto) {
    const palabras = (dto.buscar ?? '').split(/\s+/).filter(Boolean);
    // La obligación solo tiene sentido en servidores activos: se ignora el estatus.
    const estatus =
      dto.obligado !== undefined ? 'activos' : (dto.estatus ?? 'activos');

    const condiciones: WhereOptions[] = [];

    // Cada palabra debe aparecer en algún campo (no necesariamente el mismo).
    if (palabras.length) {
      condiciones.push({
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
      });
    }
    if (dto.dependenciaId) {
      condiciones.push({ tipoDependenciaId: dto.dependenciaId });
    }
    if (estatus === 'baja') condiciones.push({ deletedAt: { [Op.ne]: null } });

    // La obligación vive en declaranet: se resuelve primero qué servidores
    // tienen como último movimiento uno obligado (o no obligado).
    if (dto.obligado !== undefined) {
      const ids = await this.idsPorObligado(dto.obligado);
      condiciones.push({ id: { [Op.in]: ids } });
    }

    const sentido = dto.direccion === 'desc' ? 'DESC' : 'ASC';
    const orden =
      dto.ordenar === 'curp'
        ? literal(`\`ServidorPublico\`.\`curp\` ${sentido}`)
        : dto.ordenar === 'dependencia'
          ? literal(`\`dependencia\`.\`nombre\` ${sentido}`)
          : literal(
              `CONCAT_WS(' ', \`ServidorPublico\`.\`nombre\`, \`ServidorPublico\`.\`primer_apellido\`, \`ServidorPublico\`.\`segundo_apellido\`) ${sentido}`,
            );

    const { count, rows } = await this.servidorModel.findAndCountAll({
      where: condiciones.length ? { [Op.and]: condiciones } : {},
      include: [
        { model: TipoDependencia, as: 'dependencia', paranoid: false },
        { model: TipoDireccion, as: 'direccion', paranoid: false },
      ],
      // 'baja' y 'todos' incluyen a los dados de baja (borrado lógico).
      paranoid: estatus === 'activos',
      order: [orden, ['id', 'ASC']],
      offset: dto.inicio ?? 0,
      limit: dto.limite ?? 10,
      subQuery: false,
    });

    const ultimos = await this.ultimosMovimientos(rows.map((s) => s.id));

    return {
      total: count,
      filas: rows.map((s) => {
        const ultimo = ultimos.get(s.id) ?? null;
        const baja = !!s.deletedAt;
        const estatusFila: EstatusServidor = baja
          ? 'baja'
          : !ultimo
            ? 'sin_movimiento'
            : ultimo.obligado
              ? 'obligado'
              : 'no_obligado';
        return {
          id: s.id,
          nombre: nombreCompleto(s),
          curp: s.curp,
          dependencia: s.dependencia?.nombre ?? null,
          direccion: s.direccion?.nombre ?? null,
          estatus: estatusFila,
          obligado: ultimo ? ultimo.obligado : null,
          ultimoMovimiento: ultimo
            ? { tipo: ultimo.tipo, fecha: ultimo.fecha }
            : null,
        };
      }),
    };
  }

  /** Ids de servidores cuyo último movimiento es (o no) obligado. */
  private async idsPorObligado(obligado: boolean): Promise<number[]> {
    const filas = await this.declaracionModel.sequelize!.query<{
      servidor_publico_id: number;
    }>(
      // Ventana en lugar de subconsulta correlacionada: esta última tarda minutos
      // sobre declaraciones (MyISAM, sin índice por servidor).
      `SELECT t.servidor_publico_id
         FROM (
           SELECT d.servidor_publico_id, d.obligado,
                  ROW_NUMBER() OVER (
                    PARTITION BY d.servidor_publico_id
                    ORDER BY d.fecha_declaracion DESC, d.id DESC
                  ) AS orden
             FROM declaraciones d
            WHERE d.deleted_at IS NULL
              AND d.tipo_movimiento_id <> :intereses
         ) t
        WHERE t.orden = 1 AND t.obligado = :obligado`,
      {
        replacements: {
          intereses: TIPO_MOV_INTERESES,
          obligado: obligado ? 1 : 0,
        },
        type: QueryTypes.SELECT,
      },
    );
    // Con un arreglo vacío IN () no es válido: 0 no coincide con ningún id.
    return filas.length ? filas.map((f) => Number(f.servidor_publico_id)) : [0];
  }

  /** Último movimiento (sin intereses) de cada servidor de la página. */
  private async ultimosMovimientos(
    ids: number[],
  ): Promise<
    Map<number, { tipo: string | null; fecha: string; obligado: boolean }>
  > {
    const resultado = new Map<
      number,
      { tipo: string | null; fecha: string; obligado: boolean }
    >();
    if (ids.length === 0) return resultado;

    const [declaraciones, tipos] = await Promise.all([
      this.declaracionModel.findAll({
        where: {
          servidorPublicoId: ids,
          tipoMovimientoId: { [Op.ne]: TIPO_MOV_INTERESES },
        },
        order: [
          ['fechaDeclaracion', 'DESC'],
          ['id', 'DESC'],
        ],
      }),
      this.tipoMovimientoModel.findAll({ paranoid: false }),
    ]);
    const nombreTipo = new Map(tipos.map((t) => [Number(t.id), t.valor]));
    for (const d of declaraciones) {
      // BIGINT UNSIGNED puede llegar como texto: la llave siempre es numérica.
      const servidorId = Number(d.servidorPublicoId);
      if (resultado.has(servidorId)) continue;
      resultado.set(servidorId, {
        tipo: nombreTipo.get(Number(d.tipoMovimientoId)) ?? null,
        fecha: d.fechaDeclaracion,
        obligado: !!d.obligado,
      });
    }
    return resultado;
  }

  async detalle(id: number) {
    const servidor = await this.buscarServidor(id);
    const usuario = await this.userModel.findOne({
      where: { servidorPublicoId: id },
      order: [['id', 'ASC']],
    });

    const movimientoInicial = await this.movimientoInicial(id);

    return {
      id: servidor.id,
      nombre: servidor.nombre,
      primerApellido: servidor.primerApellido,
      segundoApellido: servidor.segundoApellido,
      rfc: servidor.rfc?.trim() ?? null,
      homoclave: servidor.homoclave?.trim() ?? null,
      curp: servidor.curp?.trim() ?? null,
      fechaInicio: servidor.fechaInicio,
      movimientoInicial,
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

    const usuario = await this.userModel.findOne({
      where: { servidorPublicoId: id },
      order: [['id', 'ASC']],
    });
    const email = dto.email?.trim() || undefined;
    const antes: Valores = {
      rfc: servidor.rfc,
      homoclave: servidor.homoclave,
      curp: servidor.curp,
      nombre: servidor.nombre,
      primerApellido: servidor.primerApellido,
      segundoApellido: servidor.segundoApellido,
      cargo: servidor.cargo,
      nivelCargo: servidor.nivelCargo,
      cveIssemym: servidor.cveIssemym,
      tipoDependenciaId: servidor.tipoDependenciaId,
      tipoDireccionId: servidor.tipoDireccionId,
      tipoDepartamentoId: servidor.tipoDepartamentoId,
      honorarios: servidor.honorarios,
      email: usuario?.email,
    };
    const datos = this.atributos(dto);
    const cambios = calcularCambios(antes, {
      ...(datos as unknown as Valores),
      // Sin correo en la petición no se toca el del usuario.
      email,
    });

    if (cambios.length === 0) return this.detalle(id);

    const motivo = dto.motivo?.trim();
    if (!motivo) {
      throw new BadRequestException('El motivo del cambio es obligatorio');
    }
    const cambiaCorreo = cambios.some((c) => c.campo === 'email');
    if (cambiaCorreo && !usuario) {
      throw new BadRequestException(
        'El servidor público no tiene usuario en Declaranet',
      );
    }
    const detallados = await this.nombrarCambios(cambios);

    await this.sequelize.transaction(async (transaction) => {
      await servidor.update(datos, { transaction });

      if (cambiaCorreo && usuario && email) {
        const repetido = await this.userModel.findOne({
          where: { email, id: { [Op.ne]: usuario.id } },
          transaction,
        });
        if (repetido) {
          throw new ConflictException('Ese correo ya está en uso');
        }
        await usuario.update({ email }, { transaction });
        await servidor.update({ cPersonal: email }, { transaction });
      }

      await this.bitacora.registrar(
        {
          logName: 'ServidorPublico',
          descripcion: `Servidor público ${id} actualizado`,
          sujeto: 'servidor',
          sujetoId: id,
          usuarioId: actorId,
          propiedades: { motivo, cambios: detallados },
        },
        transaction,
      );
    });

    this.logger.log(
      `Usuario ${actorId} actualizó al servidor ${id} (${cambios.map((c) => c.campo).join(', ')})`,
    );
    return this.detalle(id);
  }

  /** Cambia los ids de adscripción y honorarios por su nombre, para la bitácora. */
  private async nombrarCambios(cambios: Cambio[]): Promise<Cambio[]> {
    const nombre = async (campo: string, valor: string | null) => {
      if (valor === null) return null;
      const pk = Number(valor);
      const registro =
        campo === 'tipoDependenciaId'
          ? await this.dependenciaModel.findByPk(pk, { paranoid: false })
          : campo === 'tipoDireccionId'
            ? await this.direccionModel.findByPk(pk, { paranoid: false })
            : campo === 'tipoDepartamentoId'
              ? await this.departamentoModel.findByPk(pk, { paranoid: false })
              : null;
      const texto = (registro as { nombre?: string } | null)?.nombre;
      if (texto) return texto;
      if (campo === 'honorarios') {
        const r = await this.respuestaModel.findByPk(pk);
        return r?.respuesta ?? valor;
      }
      return valor;
    };
    const resultado: Cambio[] = [];
    for (const c of cambios) {
      resultado.push({
        ...c,
        antes: await nombre(c.campo, c.antes),
        despues: await nombre(c.campo, c.despues),
      });
    }
    return resultado;
  }

  /** Primer movimiento (sin intereses) del servidor: el que dio lugar a su alta. */
  private async movimientoInicial(servidorId: number) {
    const declaracion = await this.declaracionModel.findOne({
      where: {
        servidorPublicoId: servidorId,
        tipoMovimientoId: { [Op.ne]: TIPO_MOV_INTERESES },
      },
      order: [
        ['fechaDeclaracion', 'ASC'],
        ['id', 'ASC'],
      ],
    });
    if (!declaracion) return null;
    const tipo = await this.tipoMovimientoModel.findByPk(
      declaracion.tipoMovimientoId,
      { paranoid: false },
    );
    return {
      tipoMovimientoId: declaracion.tipoMovimientoId,
      tipo: tipo?.valor ?? null,
      fecha: declaracion.fechaDeclaracion,
    };
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
