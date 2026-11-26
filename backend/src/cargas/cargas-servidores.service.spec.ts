import { BadRequestException } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import { Op } from 'sequelize';
import { Declaracion } from '../database/models/declaracion.model';
import { ServidorPublico } from '../database/models/servidor-publico.model';
import { ServidoresService } from '../servidores/servidores.service';
import { CargasServidoresService } from './cargas-servidores.service';
import { copiarArbolDeclaracion, deshacerCopia } from './copiar-declaracion';

jest.mock('./copiar-declaracion');

const ENCABEZADO =
  'nombre,primer_apellido,segundo_apellido,curp,rfc,homoclave,fecha_inicio,cargo,nivel_cargo,cve_issemym,dependencia_id,direccion_id,departamento_id,honorarios,tipo_movimiento,fecha_movimiento,obligado';

const renglon = (sobre: Record<string, string> = {}) => {
  const base: Record<string, string> = {
    nombre: 'ana',
    primer_apellido: 'lopez',
    segundo_apellido: '',
    curp: 'LOPA010101MMCPNA09',
    rfc: 'LOPA010101',
    homoclave: 'AB1',
    fecha_inicio: '01/01/2025',
    cargo: 'analista',
    nivel_cargo: '25-1',
    cve_issemym: '',
    dependencia_id: '3',
    direccion_id: '7',
    departamento_id: '',
    honorarios: 'NO',
    tipo_movimiento: '1',
    fecha_movimiento: '15/01/2025',
    obligado: '',
    ...sobre,
  };
  return ENCABEZADO.split(',')
    .map((c) => base[c])
    .join(',');
};

const csv = (...renglones: string[]) => ({
  buffer: Buffer.from([ENCABEZADO, ...renglones].join('\n')),
  originalname: 'servidores.csv',
  mimetype: 'text/csv',
  size: 1,
});

describe('CargasServidoresService', () => {
  let service: CargasServidoresService;

  const transaction = { commit: jest.fn(), rollback: jest.fn() };
  const sequelize = { transaction: jest.fn() };
  const conexionDeclaranet = { query: jest.fn() };
  const servidorModel = { create: jest.fn(), findAll: jest.fn() };
  const declaracionModel = {
    create: jest.fn(),
    findOne: jest.fn(),
    sequelize: conexionDeclaranet,
  };
  const servidoresService = {
    validarAlta: jest.fn(),
    atributos: jest.fn((dto: object, extra: object) => ({ ...dto, ...extra })),
  };

  const existente = (sobre: Record<string, unknown> = {}) => ({
    id: 10,
    curp: 'LOPA010101MMCPNA09',
    rfc: 'LOPA010101',
    honorarios: 2,
    update: jest.fn().mockResolvedValue(undefined),
    ...sobre,
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    sequelize.transaction.mockResolvedValue(transaction);
    transaction.rollback.mockResolvedValue(undefined);
    servidorModel.findAll.mockResolvedValue([]);
    servidoresService.atributos.mockImplementation(
      (dto: object, extra: object) => ({ ...dto, ...extra }),
    );
    jest.mocked(copiarArbolDeclaracion).mockResolvedValue(undefined);
    jest.mocked(deshacerCopia).mockResolvedValue(undefined);

    const modulo = await Test.createTestingModule({
      providers: [
        CargasServidoresService,
        { provide: getConnectionToken(), useValue: sequelize },
        { provide: getModelToken(ServidorPublico), useValue: servidorModel },
        {
          provide: getModelToken(Declaracion, 'declaranet'),
          useValue: declaracionModel,
        },
        { provide: ServidoresService, useValue: servidoresService },
      ],
    }).compile();
    service = modulo.get(CargasServidoresService);
  });

  describe('previsualizar', () => {
    it('marca como alta un renglón correcto de un servidor nuevo y normaliza los datos', async () => {
      const resultado = await service.previsualizar(csv(renglon()));

      expect(resultado).toEqual({
        total: 1,
        validas: 1,
        conErrores: 0,
        filas: [
          {
            renglon: 2,
            curp: 'LOPA010101MMCPNA09',
            nombre: 'ANA LOPEZ',
            errores: [],
            accion: 'alta',
          },
        ],
      });
      expect(servidoresService.validarAlta).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'ANA',
          fechaInicio: '2025-01-01',
          fechaDeclaracion: '2025-01-15',
          honorarios: 2,
          tipoDependenciaId: 3,
          tipoDireccionId: 7,
          tipoDepartamentoId: null,
        }),
      );
      expect(servidorModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            [Op.or]: [{ curp: 'LOPA010101MMCPNA09' }, { rfc: 'LOPA010101' }],
          },
        }),
      );
    });

    it('un servidor que ya existe con la misma CURP y RFC no es error: es un movimiento', async () => {
      servidorModel.findAll.mockResolvedValue([existente()]);

      const resultado = await service.previsualizar(csv(renglon()));

      expect(resultado.conErrores).toBe(0);
      expect(resultado.filas[0]).toMatchObject({
        errores: [],
        accion: 'movimiento',
      });
    });

    it('reporta error si la CURP existe con otro RFC', async () => {
      servidorModel.findAll.mockResolvedValue([
        existente({ rfc: 'OTRA010101' }),
      ]);

      const { filas } = await service.previsualizar(csv(renglon()));

      expect(filas[0].accion).toBeNull();
      expect(filas[0].errores).toEqual([
        'La CURP ya existe con otro RFC (OTRA010101); no coincide con el RFC LOPA010101',
      ]);
    });

    it('reporta error si el RFC existe con otra CURP', async () => {
      servidorModel.findAll.mockResolvedValue([
        existente({ curp: 'ZZZZ010101MMCPNA09' }),
      ]);

      const { filas } = await service.previsualizar(csv(renglon()));

      expect(filas[0].errores).toEqual([
        'El RFC ya existe con otra CURP (ZZZZ010101MMCPNA09); no coincide con la CURP LOPA010101MMCPNA09',
      ]);
    });

    it('reporta errores de formato en español, sin duplicar datos faltantes', async () => {
      const resultado = await service.previsualizar(
        csv(
          renglon({
            curp: 'XX',
            fecha_inicio: '31/02/2025',
            honorarios: 'tal',
          }),
          renglon({ nombre: '', rfc: '' }),
        ),
      );

      const [a, b] = resultado.filas;
      expect(a.errores).toEqual(
        expect.arrayContaining([
          'La fecha de inicio no es válida (usa dd/mm/aaaa)',
          'Honorarios debe ser 1, 2, SI o NO',
          'La CURP debe tener 18 caracteres',
          'La CURP no tiene un formato válido',
        ]),
      );
      expect(a.errores.join(' ')).not.toMatch(/must|fechaInicio/);
      expect(b.errores).toEqual([
        'Falta el dato "nombre"',
        'Falta el dato "rfc"',
      ]);
      expect(resultado.conErrores).toBe(2);
      expect(servidoresService.validarAlta).not.toHaveBeenCalled();
    });

    it('acepta SI/SÍ como honorarios y fechas aaaa-mm-dd', async () => {
      await service.previsualizar(
        csv(renglon({ honorarios: 'Sí', fecha_movimiento: '2025-01-15' })),
      );
      expect(servidoresService.validarAlta).toHaveBeenCalledWith(
        expect.objectContaining({
          honorarios: 1,
          fechaDeclaracion: '2025-01-15',
        }),
      );
    });

    it('la columna obligado es opcional', async () => {
      const sinColumna = {
        buffer: Buffer.from(
          [
            ENCABEZADO.replace(',obligado', ''),
            renglon().replace(/,$/, ''),
          ].join('\n'),
        ),
        originalname: 'servidores.csv',
        mimetype: 'text/csv',
        size: 1,
      };
      const resultado = await service.previsualizar(sinColumna);
      expect(resultado.conErrores).toBe(0);
    });

    it('detecta repetidos dentro del archivo por CURP y por RFC+homoclave', async () => {
      const resultado = await service.previsualizar(
        csv(
          renglon(),
          renglon({ rfc: 'OTRA010101', homoclave: 'ZZ9' }),
          renglon({ curp: 'ZZZZ010101MMCPNA09' }),
        ),
      );

      expect(resultado.filas.map((f) => f.errores)).toEqual([
        [],
        ['Repetido en el renglón 2'],
        ['Repetido en el renglón 2'],
      ]);
    });

    it('convierte los errores de BD (adscripción) en errores del renglón', async () => {
      servidoresService.validarAlta
        .mockRejectedValueOnce(
          new BadRequestException('La dependencia no existe'),
        )
        .mockResolvedValueOnce(undefined);

      const resultado = await service.previsualizar(
        csv(
          renglon(),
          renglon({ curp: 'ZZZZ010101MMCPNA09', rfc: 'ZZZZ010101' }),
        ),
      );

      expect(resultado.filas[0].errores).toEqual(['La dependencia no existe']);
      expect(resultado.filas[1].errores).toEqual([]);
    });

    it('relanza errores inesperados', async () => {
      servidoresService.validarAlta.mockRejectedValue(new Error('BD caída'));
      await expect(service.previsualizar(csv(renglon()))).rejects.toThrow(
        'BD caída',
      );
    });
  });

  describe('confirmar', () => {
    const dosValidas = () =>
      csv(
        renglon(),
        renglon({ curp: 'ZZZZ010101MMCPNA09', rfc: 'ZZZZ010101' }),
        renglon({ curp: 'MALO' }),
      );

    it('da de alta al servidor nuevo con su primera declaración (obligado por omisión)', async () => {
      servidorModel.create
        .mockResolvedValueOnce({ id: 10 })
        .mockResolvedValueOnce({ id: 11 });
      declaracionModel.create.mockResolvedValue({ id: 1 });

      const resultado = await service.confirmar(dosValidas(), 1);

      expect(resultado).toEqual({
        insertados: 2,
        nuevos: 2,
        actualizados: 0,
        omitidos: 1,
        fallidos: [],
      });
      expect(servidorModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ fechaInicio: '2025-01-01' }),
        { transaction },
      );
      expect(declaracionModel.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          servidorPublicoId: 11,
          tipoMovimientoId: 1,
          fechaDeclaracion: '2025-01-15',
          estatusDeclaracionId: 1,
          honorarios: 2,
          cargo: 'ANALISTA',
          nivelCargo: '25-1',
          obligado: true,
          motivoNoObligadoId: null,
        }),
      );
      expect(sequelize.transaction).toHaveBeenCalledTimes(2);
      expect(transaction.commit).toHaveBeenCalledTimes(2);
      expect(transaction.rollback).not.toHaveBeenCalled();
      expect(copiarArbolDeclaracion).not.toHaveBeenCalled();
    });

    it('obligado=1 marca no obligado con motivo 3; cualquier otro valor, obligado', async () => {
      servidorModel.create.mockResolvedValue({ id: 10 });
      declaracionModel.create.mockResolvedValue({ id: 1 });

      await service.confirmar(
        csv(
          renglon({ obligado: '1' }),
          renglon({
            curp: 'ZZZZ010101MMCPNA09',
            rfc: 'ZZZZ010101',
            obligado: '0',
          }),
        ),
        1,
      );

      expect(declaracionModel.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ obligado: false, motivoNoObligadoId: 3 }),
      );
      expect(declaracionModel.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ obligado: true, motivoNoObligadoId: null }),
      );
    });

    it('si el servidor existe: actualiza cargo/adscripción, crea declaración y copia la anterior', async () => {
      const servidor = existente();
      servidorModel.findAll.mockResolvedValue([servidor]);
      declaracionModel.findOne.mockResolvedValue({
        id: 77,
        correoInstitucional: 'a@b.mx',
        honorarios: 1,
        paisId: 4,
      });
      declaracionModel.create.mockResolvedValue({ id: 99 });

      const resultado = await service.confirmar(
        csv(renglon({ obligado: '1', cve_issemym: '1234567' })),
        1,
      );

      expect(resultado).toEqual({
        insertados: 1,
        nuevos: 0,
        actualizados: 1,
        omitidos: 0,
        fallidos: [],
      });
      expect(servidorModel.create).not.toHaveBeenCalled();
      expect(servidor.update).toHaveBeenCalledWith(
        {
          nivelCargo: '25-1',
          cargo: 'ANALISTA',
          cveIssemym: '1234567',
          tipoDependenciaId: 3,
          tipoDireccionId: 7,
          tipoDepartamentoId: null,
        },
        { transaction },
      );
      expect(declaracionModel.findOne).toHaveBeenCalledWith({
        where: {
          servidorPublicoId: 10,
          tipoMovimientoId: { [Op.ne]: 5 },
        },
        order: [['id', 'DESC']],
      });
      expect(declaracionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          servidorPublicoId: 10,
          tipoMovimientoId: 1,
          fechaDeclaracion: '2025-01-15',
          estatusDeclaracionId: 1,
          obligado: false,
          motivoNoObligadoId: 3,
          cargo: 'ANALISTA',
          nivelCargo: '25-1',
          correoInstitucional: 'a@b.mx',
          honorarios: 1,
          paisId: 4,
        }),
      );
      expect(copiarArbolDeclaracion).toHaveBeenCalledWith(
        conexionDeclaranet,
        77,
        99,
        expect.any(Map),
      );
      expect(transaction.commit).toHaveBeenCalled();
    });

    it('si el servidor existe y no tiene declaración previa, no copia nada', async () => {
      servidorModel.findAll.mockResolvedValue([existente()]);
      declaracionModel.findOne.mockResolvedValue(null);
      declaracionModel.create.mockResolvedValue({ id: 99 });

      await service.confirmar(csv(renglon()), 1);

      expect(declaracionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ honorarios: 2, obligado: true }),
      );
      expect(copiarArbolDeclaracion).not.toHaveBeenCalled();
    });

    it('responde 400 si no hay renglones válidos', async () => {
      await expect(
        service.confirmar(csv(renglon({ curp: 'MALO' })), 1),
      ).rejects.toThrow('No hay renglones válidos para cargar');
      expect(sequelize.transaction).not.toHaveBeenCalled();
    });

    it('un renglón que falla se revierte y compensa sin detener los demás', async () => {
      servidorModel.create
        .mockResolvedValueOnce({ id: 10 })
        .mockResolvedValueOnce({ id: 11 });
      const huerfana = {
        id: 5,
        destroy: jest.fn().mockResolvedValue(undefined),
      };
      declaracionModel.create
        .mockResolvedValueOnce(huerfana)
        .mockRejectedValueOnce(new Error('declaranet caído'))
        .mockResolvedValueOnce({ id: 6 });

      const resultado = await service.confirmar(
        csv(
          renglon(),
          renglon({ curp: 'ZZZZ010101MMCPNA09', rfc: 'ZZZZ010101' }),
        ),
        1,
      );

      expect(resultado.insertados).toBe(1);
      expect(resultado.fallidos).toEqual([
        { renglon: 3, mensaje: 'Error inesperado al guardar el renglón' },
      ]);
      expect(transaction.rollback).toHaveBeenCalledTimes(1);
      expect(deshacerCopia).toHaveBeenCalledTimes(1);
      expect(transaction.commit).toHaveBeenCalledTimes(1);
    });

    it('si falla el commit borra la declaración creada', async () => {
      servidorModel.create.mockResolvedValue({ id: 10 });
      const declaracion = {
        id: 5,
        destroy: jest.fn().mockResolvedValue(undefined),
      };
      declaracionModel.create.mockResolvedValue(declaracion);
      transaction.commit.mockRejectedValue(new Error('commit falló'));

      const resultado = await service.confirmar(csv(renglon()), 1);

      expect(resultado.fallidos).toHaveLength(1);
      expect(transaction.rollback).toHaveBeenCalled();
      expect(declaracion.destroy).toHaveBeenCalledWith({ force: true });
    });

    it('si falla la copia del árbol revierte, deshace lo copiado y reporta el renglón', async () => {
      servidorModel.findAll.mockResolvedValue([existente()]);
      declaracionModel.findOne.mockResolvedValue({ id: 77 });
      const nueva = { id: 99, destroy: jest.fn().mockResolvedValue(undefined) };
      declaracionModel.create.mockResolvedValue(nueva);
      jest
        .mocked(copiarArbolDeclaracion)
        .mockRejectedValue(new Error('falla copia'));

      const resultado = await service.confirmar(csv(renglon()), 1);

      expect(resultado).toMatchObject({ insertados: 0, omitidos: 1 });
      expect(resultado.fallidos).toHaveLength(1);
      expect(transaction.rollback).toHaveBeenCalled();
      expect(transaction.commit).not.toHaveBeenCalled();
      expect(deshacerCopia).toHaveBeenCalledWith(
        conexionDeclaranet,
        expect.any(Map),
      );
      expect(nueva.destroy).toHaveBeenCalledWith({ force: true });
    });

    it('si al confirmar aparece un conflicto de CURP/RFC, solo falla ese renglón', async () => {
      // Previsualización: sin coincidencias; al confirmar: la CURP ya existe con otro RFC.
      servidorModel.findAll
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([existente({ rfc: 'OTRA010101' })]);

      const resultado = await service.confirmar(csv(renglon()), 1);

      expect(resultado.insertados).toBe(0);
      expect(resultado.fallidos[0]).toEqual({
        renglon: 2,
        mensaje:
          'La CURP ya existe con otro RFC (OTRA010101); no coincide con el RFC LOPA010101',
      });
      expect(transaction.rollback).toHaveBeenCalled();
      expect(declaracionModel.create).not.toHaveBeenCalled();
    });
  });

  it('el layout trae BOM, encabezado y un renglón de ejemplo', () => {
    const texto = service.layout().toString('utf-8');
    expect(texto.charCodeAt(0)).toBe(0xfeff);
    expect(texto.slice(1).split('\r\n')[0]).toBe(ENCABEZADO);
    expect(texto.split('\r\n')).toHaveLength(3);
  });
});
