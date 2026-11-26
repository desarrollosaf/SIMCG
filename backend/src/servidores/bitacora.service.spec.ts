import { getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import { ActivityLog } from '../database/models/activity-log.model';
import { BitacoraService } from './bitacora.service';

const B = String.fromCharCode(92);

describe('BitacoraService', () => {
  const activityLogModel = { create: jest.fn() };
  let service: BitacoraService;

  beforeEach(async () => {
    jest.resetAllMocks();
    const modulo = await Test.createTestingModule({
      providers: [
        BitacoraService,
        { provide: getModelToken(ActivityLog), useValue: activityLogModel },
      ],
    }).compile();
    service = modulo.get(BitacoraService);
  });

  it('inserta en activity_log con el formato del sistema viejo', async () => {
    const transaction = {} as never;
    await service.registrar(
      {
        logName: 'ServidorPublico',
        descripcion: 'Servidor actualizado',
        sujeto: 'servidor',
        sujetoId: 5,
        usuarioId: 9,
        propiedades: { motivo: 'X', cambios: [] },
      },
      transaction,
    );

    expect(activityLogModel.create).toHaveBeenCalledWith(
      {
        logName: 'ServidorPublico',
        description: 'Servidor actualizado',
        subjectType: `App${B}ServidorPublico`,
        subjectId: 5,
        causerType: `App${B}User`,
        causerId: 9,
        properties: JSON.stringify({ motivo: 'X', cambios: [] }),
      },
      { transaction },
    );
  });

  it('las declaraciones usan Declaracion como sujeto', async () => {
    await service.registrar({
      logName: 'declaracion',
      descripcion: 'x',
      sujeto: 'declaracion',
      sujetoId: 1,
      usuarioId: 1,
      propiedades: {},
    });
    const [datos] = activityLogModel.create.mock.calls[0] as [
      { subjectType: string },
    ];
    expect(datos.subjectType).toBe(`App${B}Declaracion`);
  });
});
