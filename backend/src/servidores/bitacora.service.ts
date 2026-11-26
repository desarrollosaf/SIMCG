import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Transaction } from 'sequelize';
import { ActivityLog } from '../database/models/activity-log.model';

// Mismos nombres de clase que guardaba el sistema viejo (Laravel), para que la
// bitácora siga leyéndose igual desde ahí.
const BARRA = String.fromCharCode(92);
const TIPO_USUARIO = `App${BARRA}User`;
const TIPO_SERVIDOR = `App${BARRA}ServidorPublico`;
const TIPO_DECLARACION = `App${BARRA}Declaracion`;

export interface EntradaBitacora {
  logName: 'ServidorPublico' | 'declaracion';
  descripcion: string;
  sujeto: 'servidor' | 'declaracion';
  sujetoId: number;
  usuarioId: number;
  propiedades: Record<string, unknown>;
}

/** Escribe en activity_log (cddiputados) con el formato de spatie/laravel-activitylog. */
@Injectable()
export class BitacoraService {
  constructor(
    @InjectModel(ActivityLog)
    private readonly activityLogModel: typeof ActivityLog,
  ) {}

  async registrar(
    entrada: EntradaBitacora,
    transaction?: Transaction,
  ): Promise<void> {
    await this.activityLogModel.create(
      {
        logName: entrada.logName,
        description: entrada.descripcion,
        subjectType:
          entrada.sujeto === 'servidor' ? TIPO_SERVIDOR : TIPO_DECLARACION,
        subjectId: entrada.sujetoId,
        causerType: TIPO_USUARIO,
        causerId: entrada.usuarioId,
        properties: JSON.stringify(entrada.propiedades),
      },
      { transaction },
    );
  }
}
