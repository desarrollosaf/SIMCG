import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { MotivoNoObligado } from '../database/models/motivo-no-obligado.model';
import { Respuesta } from '../database/models/respuesta.model';
import { TipoDepartamento } from '../database/models/tipo-departamento.model';
import { TipoDependencia } from '../database/models/tipo-dependencia.model';
import { TipoDireccion } from '../database/models/tipo-direccion.model';
import {
  TIPO_MOV_INTERESES,
  TipoMovimientoMcg,
} from '../database/models/tipo-movimiento-mcg.model';

@Injectable()
export class CatalogosService {
  constructor(
    @InjectModel(TipoDependencia)
    private readonly dependenciaModel: typeof TipoDependencia,
    @InjectModel(TipoDireccion)
    private readonly direccionModel: typeof TipoDireccion,
    @InjectModel(TipoDepartamento)
    private readonly departamentoModel: typeof TipoDepartamento,
    @InjectModel(TipoMovimientoMcg)
    private readonly tipoMovimientoModel: typeof TipoMovimientoMcg,
    @InjectModel(Respuesta) private readonly respuestaModel: typeof Respuesta,
    @InjectModel(MotivoNoObligado, 'declaranet')
    private readonly motivoModel: typeof MotivoNoObligado,
  ) {}

  async dependencias() {
    const filas = await this.dependenciaModel.findAll({
      order: [['nombre', 'ASC']],
    });
    return filas.map((f) => ({ id: f.id, nombre: f.nombre }));
  }

  async direcciones(dependenciaId?: number) {
    const filas = await this.direccionModel.findAll({
      where: dependenciaId ? { dependenciaId } : {},
      order: [['nombre', 'ASC']],
    });
    return filas.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      dependenciaId: f.dependenciaId,
    }));
  }

  async departamentos(direccionId?: number) {
    const filas = await this.departamentoModel.findAll({
      where: direccionId ? { direccionId } : {},
      order: [['nombre', 'ASC']],
    });
    return filas.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      direccionId: f.direccionId,
    }));
  }

  // Sin INTERESES: esas declaraciones se manejan en su propio módulo.
  async tiposMovimiento() {
    const filas = await this.tipoMovimientoModel.findAll({
      where: { id: { [Op.ne]: TIPO_MOV_INTERESES } },
      order: [['id', 'ASC']],
    });
    return filas.map((f) => ({ id: f.id, valor: f.valor }));
  }

  async respuestas() {
    const filas = await this.respuestaModel.findAll({ order: [['id', 'ASC']] });
    return filas.map((f) => ({ id: f.id, respuesta: f.respuesta }));
  }

  async motivosNoObligado() {
    const filas = await this.motivoModel.findAll({ order: [['id', 'ASC']] });
    return filas.map((f) => ({ id: f.id, causa: f.causa }));
  }
}
