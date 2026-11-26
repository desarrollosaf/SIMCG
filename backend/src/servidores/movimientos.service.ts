import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import type { Sequelize } from 'sequelize-typescript';
import {
  copiarArbolDeclaracion,
  deshacerCopia,
  FilasCreadas,
} from '../cargas/copiar-declaracion';
import {
  Declaracion,
  ESTATUS_DECLARACION_INICIAL,
} from '../database/models/declaracion.model';
import {
  EnvioCorreo,
  TIPO_CORREO_PREVENTIVO,
  TIPO_CORREO_REMISION,
} from '../database/models/envio-correo.model';
import { EstatusDeclaracion } from '../database/models/estatus-declaracion.model';
import { MotivoNoObligado } from '../database/models/motivo-no-obligado.model';
import {
  TIPO_MOV_INGRESO,
  TIPO_MOV_INTERESES,
  TipoMovimientoMcg,
} from '../database/models/tipo-movimiento-mcg.model';
import { ServidorPublico } from '../database/models/servidor-publico.model';
import { BitacoraService } from './bitacora.service';
import {
  calcularEstatus,
  estadoObligado,
  hoyMexico,
  tiposPermitidos,
} from './movimientos.reglas';

const PREFIJO_OFICIO = 'CPL/DSP/MCG/';

// Campos escalares que un movimiento nuevo hereda del anterior.
const CAMPOS_HEREDADOS = [
  'correoInstitucional',
  'correoPersonal',
  'telefonoCasa',
  'telefonoPersonal',
  'situacionPersonalId',
  'regimenMatrimonialId',
  'honorarios',
  'paisId',
  'nacionalidad',
  'nacionalidadId',
  'regimenEspecificar',
  'observaciones',
  'regimenMatrimonial',
] as const;

@Injectable()
export class MovimientosService {
  private readonly logger = new Logger(MovimientosService.name);

  constructor(
    @InjectModel(ServidorPublico)
    private readonly servidorModel: typeof ServidorPublico,
    @InjectModel(TipoMovimientoMcg)
    private readonly tipoMovimientoModel: typeof TipoMovimientoMcg,
    @InjectModel(EnvioCorreo)
    private readonly envioCorreoModel: typeof EnvioCorreo,
    @InjectModel(Declaracion, 'declaranet')
    private readonly declaracionModel: typeof Declaracion,
    @InjectModel(MotivoNoObligado, 'declaranet')
    private readonly motivoModel: typeof MotivoNoObligado,
    @InjectModel(EstatusDeclaracion, 'declaranet')
    private readonly estatusDeclaracionModel: typeof EstatusDeclaracion,
    private readonly bitacora: BitacoraService,
  ) {}

  /** Historial del servidor (sin declaraciones de intereses), del más antiguo al más reciente. */
  async historial(servidorId: number) {
    await this.buscarServidor(servidorId);

    const declaraciones = await this.declaracionModel.findAll({
      where: {
        servidorPublicoId: servidorId,
        tipoMovimientoId: { [Op.ne]: TIPO_MOV_INTERESES },
      },
      include: [{ model: MotivoNoObligado, paranoid: false }],
      order: [
        ['fechaDeclaracion', 'ASC'],
        ['id', 'ASC'],
      ],
    });
    if (declaraciones.length === 0) return [];

    // Tipos y oficios viven en cddiputados; las declaraciones en declaranet.
    const [tipos, estatusDeclaraciones, oficios] = await Promise.all([
      this.tipoMovimientoModel.findAll({ paranoid: false }),
      this.estatusDeclaracionModel.findAll({ paranoid: false }),
      this.envioCorreoModel.findAll({
        where: {
          declaracionId: declaraciones.map((d) => d.id),
          tipoCorreo: [TIPO_CORREO_PREVENTIVO, TIPO_CORREO_REMISION],
        },
        order: [['id', 'ASC']],
      }),
    ]);
    const nombreTipo = new Map(tipos.map((t) => [t.id, t.valor]));
    const nombreEstatusDeclaracion = new Map(
      estatusDeclaraciones.map((e) => [Number(e.id), e.estatus]),
    );
    const oficio = (declaracionId: number, tipoCorreo: number) => {
      const envio = oficios.find(
        (o) => o.declaracionId === declaracionId && o.tipoCorreo === tipoCorreo,
      );
      return envio ? `${PREFIJO_OFICIO}${envio.noOficio ?? ''}` : null;
    };

    const hoy = hoyMexico();
    return declaraciones.map((d) => {
      const obligado = !!d.obligado;
      const estado = estadoObligado(obligado, d.motivoNoObligado?.causa);
      return {
        id: d.id,
        tipoMovimientoId: d.tipoMovimientoId,
        tipo: nombreTipo.get(d.tipoMovimientoId) ?? null,
        fechaDeclaracion: d.fechaDeclaracion,
        obligado,
        motivoNoObligadoId: d.motivoNoObligadoId,
        estado,
        // El sistema viejo muestra el estado en lugar del estatus si no es obligado.
        estatus: obligado
          ? calcularEstatus({
              tipoMovimientoId: d.tipoMovimientoId,
              fechaDeclaracion: d.fechaDeclaracion,
              fechaEnvio: d.fechaEnvio,
              hoy,
            })
          : estado,
        oficioPreventivo: oficio(d.id, TIPO_CORREO_PREVENTIVO),
        oficioRemision: oficio(d.id, TIPO_CORREO_REMISION),
        fechaEnvio: d.fechaEnvio,
        // Iniciada / Terminada / Enviada (catálogo estatus_declaraciones).
        estatusDeclaracion:
          nombreEstatusDeclaracion.get(Number(d.estatusDeclaracionId)) ?? null,
      };
    });
  }

  /** Tipos de movimiento que se pueden registrar hoy para el servidor. */
  async permitidos(servidorId: number) {
    await this.buscarServidor(servidorId);

    const tipos = await this.tipoMovimientoModel.findAll({
      where: { id: { [Op.ne]: TIPO_MOV_INTERESES } },
      order: [['id', 'ASC']],
    });

    const hoy = hoyMexico();
    const anio = hoy.slice(0, 4);
    const ultimo = await this.declaracionModel.findOne({
      where: {
        servidorPublicoId: servidorId,
        tipoMovimientoId: { [Op.ne]: TIPO_MOV_INTERESES },
        fechaDeclaracion: { [Op.between]: [`${anio}-01-01`, `${anio}-12-31`] },
      },
      order: [
        ['fechaDeclaracion', 'DESC'],
        ['id', 'DESC'],
      ],
    });

    const ids = tiposPermitidos(
      tipos.map((t) => t.id),
      ultimo
        ? {
            tipoMovimientoId: ultimo.tipoMovimientoId,
            fechaDeclaracion: ultimo.fechaDeclaracion,
          }
        : null,
      anio,
    );
    return tipos
      .filter((t) => ids.includes(t.id))
      .map((t) => ({ id: t.id, valor: t.valor }));
  }

  async crear(servidorId: number, tipoMovimientoId: number, actorId: number) {
    const servidor = await this.buscarServidor(servidorId);

    const permitidos = await this.permitidos(servidorId);
    if (!permitidos.some((t) => t.id === tipoMovimientoId)) {
      throw new BadRequestException(
        'Ese tipo de movimiento no se puede registrar en este momento',
      );
    }

    const previa = await this.declaracionModel.findOne({
      where: {
        servidorPublicoId: servidorId,
        tipoMovimientoId: { [Op.ne]: TIPO_MOV_INTERESES },
      },
      order: [['id', 'DESC']],
    });

    const datos: Record<string, unknown> = {
      servidorPublicoId: servidorId,
      tipoMovimientoId,
      fechaDeclaracion: hoyMexico(),
      estatusDeclaracionId: ESTATUS_DECLARACION_INICIAL,
      cargo: servidor.cargo,
      nivelCargo: servidor.nivelCargo,
      honorarios: servidor.honorarios,
    };
    // Como el sistema viejo: un movimiento que no es ingreso hereda los datos
    // escalares de la declaración anterior.
    if (previa && tipoMovimientoId !== TIPO_MOV_INGRESO) {
      for (const campo of CAMPOS_HEREDADOS) {
        datos[campo] = previa[campo];
      }
    }

    const declaracion = await this.declaracionModel.create(datos);
    // Como el sistema viejo: un movimiento que no es ingreso clona todo el árbol
    // del declarante de la declaración anterior. declaranet es MyISAM (sin
    // transacciones): si algo falla se borra lo copiado y la declaración nueva.
    if (previa && tipoMovimientoId !== TIPO_MOV_INGRESO) {
      const creadas: FilasCreadas = new Map();
      try {
        await copiarArbolDeclaracion(
          this.declaracionModel.sequelize as Sequelize,
          previa.id,
          declaracion.id,
          creadas,
        );
      } catch (error) {
        this.logger.error(
          `Falló la copia de la declaración ${previa.id} a ${declaracion.id}: ${String(error)}`,
        );
        await deshacerCopia(
          this.declaracionModel.sequelize as Sequelize,
          creadas,
        ).catch((e: unknown) =>
          this.logger.error(`No se pudo deshacer la copia: ${String(e)}`),
        );
        await declaracion
          .destroy({ force: true })
          .catch((e: unknown) =>
            this.logger.error(
              `No se pudo borrar la declaración ${declaracion.id}: ${String(e)}`,
            ),
          );
        throw new InternalServerErrorException(
          'No se pudo copiar la información de la declaración anterior; el movimiento no se creó. Intenta de nuevo.',
        );
      }
    }
    await this.bitacora.registrar({
      logName: 'declaracion',
      descripcion: `Declaración creada por el usuario ${actorId}`,
      sujeto: 'declaracion',
      sujetoId: declaracion.id,
      usuarioId: actorId,
      propiedades: { servidorId, tipoMovimientoId },
    });
    this.logger.log(
      `Usuario ${actorId} creó la declaración ${declaracion.id} (tipo ${tipoMovimientoId}) del servidor ${servidorId}`,
    );
    return { id: declaracion.id };
  }

  async cambiarObligado(
    id: number,
    obligado: boolean,
    motivoNoObligadoId: number | undefined,
    actorId: number,
  ) {
    const declaracion = await this.buscarDeclaracion(id);

    if (!obligado) {
      if (!motivoNoObligadoId) {
        throw new BadRequestException('Selecciona el motivo de no obligado');
      }
      if (!(await this.motivoModel.findByPk(motivoNoObligadoId))) {
        throw new BadRequestException('El motivo de no obligado no existe');
      }
    }

    await declaracion.update({
      obligado,
      motivoNoObligadoId: obligado ? null : motivoNoObligadoId,
    });
    await this.bitacora.registrar({
      logName: 'declaracion',
      descripcion: `Status de la declaración cambiado por el usuario ${actorId}`,
      sujeto: 'declaracion',
      sujetoId: id,
      usuarioId: actorId,
      propiedades: {
        obligado,
        motivoNoObligadoId: obligado ? null : (motivoNoObligadoId ?? null),
      },
    });
    this.logger.log(
      `Usuario ${actorId} marcó la declaración ${id} obligado=${obligado}`,
    );
    return { mensaje: 'Declaración guardada correctamente' };
  }

  async eliminar(id: number, actorId: number) {
    const declaracion = await this.buscarDeclaracion(id);
    await declaracion.destroy();
    // TODO Fase 5 (auditoría): guardar en la bitácora en lugar del log.
    this.logger.log(`Usuario ${actorId} eliminó la declaración ${id}`);
    return { mensaje: 'Movimiento eliminado' };
  }

  private async buscarServidor(id: number) {
    const servidor = await this.servidorModel.findByPk(id);
    if (!servidor) {
      throw new NotFoundException('Servidor público no encontrado');
    }
    return servidor;
  }

  private async buscarDeclaracion(id: number) {
    const declaracion = await this.declaracionModel.findByPk(id);
    if (!declaracion) {
      throw new NotFoundException('Movimiento no encontrado');
    }
    return declaracion;
  }
}
