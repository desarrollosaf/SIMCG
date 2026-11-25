import { BadRequestException, ConflictException } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import { Declaracion } from '../database/models/declaracion.model';
import { ServidorPublico } from '../database/models/servidor-publico.model';
import { ServidoresService } from '../servidores/servidores.service';
import { CargasServidoresService } from './cargas-servidores.service';

const ENCABEZADO =
  'nombre,primer_apellido,segundo_apellido,curp,rfc,homoclave,fecha_inicio,cargo,nivel_cargo,cve_issemym,dependencia_id,direccion_id,departamento_id,honorarios,tipo_movimiento,fecha_movimiento';

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
  const servidorModel = { create: jest.fn() };
  const declaracionModel = { create: jest.fn(), destroy: jest.fn() };
  const servidoresService = {
    validarAlta: jest.fn(),
    validarDuplicados: jest.fn(),
    atributos: jest.fn((dto: object, extra: object) => ({ ...dto, ...extra })),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    sequelize.transaction.mockResolvedValue(transaction);
    transaction.rollback.mockResolvedValue(undefined);
    servidoresService.atributos.mockImplementation(
      (dto: object, extra: object) => ({ ...dto, ...extra }),
    );

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
    it('marca como válido un renglón correcto y normaliza los datos', async () => {
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

    it('convierte los errores de BD (adscripción, duplicados) en errores del renglón', async () => {
      servidoresService.validarAlta
        .mockRejectedValueOnce(
          new BadRequestException('La dependencia no existe'),
        )
        .mockResolvedValueOnce(undefined);
      servidoresService.validarDuplicados.mockRejectedValueOnce(
        new ConflictException('Ya existe un servidor público con esa CURP'),
      );

      const resultado = await service.previsualizar(
        csv(
          renglon(),
          renglon({ curp: 'ZZZZ010101MMCPNA09', rfc: 'ZZZZ010101' }),
        ),
      );

      expect(resultado.filas[0].errores).toEqual(['La dependencia no existe']);
      expect(resultado.filas[1].errores).toEqual([
        'Ya existe un servidor público con esa CURP',
      ]);
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

    it('inserta solo los renglones válidos y confirma', async () => {
      servidorModel.create
        .mockResolvedValueOnce({ id: 10 })
        .mockResolvedValueOnce({ id: 11 });
      declaracionModel.create.mockResolvedValue({ id: 1 });

      const resultado = await service.confirmar(dosValidas(), 1);

      expect(resultado).toEqual({ insertados: 2, omitidos: 1 });
      expect(servidorModel.create).toHaveBeenCalledTimes(2);
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
        }),
      );
      expect(transaction.commit).toHaveBeenCalled();
      expect(transaction.rollback).not.toHaveBeenCalled();
      expect(servidoresService.validarDuplicados).toHaveBeenCalledWith(
        expect.anything(),
        undefined,
        transaction,
      );
    });

    it('responde 400 si no hay renglones válidos', async () => {
      await expect(
        service.confirmar(csv(renglon({ curp: 'MALO' })), 1),
      ).rejects.toThrow('No hay renglones válidos para cargar');
      expect(sequelize.transaction).not.toHaveBeenCalled();
    });

    it('revierte y compensa en declaranet si falla una declaración', async () => {
      servidorModel.create
        .mockResolvedValueOnce({ id: 10 })
        .mockResolvedValueOnce({ id: 11 });
      declaracionModel.create
        .mockResolvedValueOnce({ id: 1 })
        .mockRejectedValueOnce(new Error('declaranet caído'));
      declaracionModel.destroy.mockResolvedValue(1);

      await expect(service.confirmar(dosValidas(), 1)).rejects.toThrow(
        'declaranet caído',
      );

      expect(transaction.rollback).toHaveBeenCalled();
      expect(transaction.commit).not.toHaveBeenCalled();
      expect(declaracionModel.destroy).toHaveBeenCalledWith({
        where: { servidorPublicoId: [10, 11] },
        force: true,
      });
    });

    it('revierte y compensa si falla el commit', async () => {
      servidorModel.create
        .mockResolvedValueOnce({ id: 10 })
        .mockResolvedValueOnce({ id: 11 });
      declaracionModel.create.mockResolvedValue({ id: 1 });
      transaction.commit.mockRejectedValue(new Error('commit falló'));
      declaracionModel.destroy.mockResolvedValue(2);

      await expect(service.confirmar(dosValidas(), 1)).rejects.toThrow(
        'commit falló',
      );
      expect(declaracionModel.destroy).toHaveBeenCalled();
    });

    it('si falla antes de crear declaraciones solo revierte el servidor', async () => {
      servidorModel.create
        .mockResolvedValueOnce({ id: 10 })
        .mockRejectedValueOnce(new Error('falla insert'));

      await expect(service.confirmar(dosValidas(), 1)).rejects.toThrow(
        'falla insert',
      );
      expect(transaction.rollback).toHaveBeenCalled();
      expect(declaracionModel.destroy).not.toHaveBeenCalled();
    });

    it('falla todo el lote con 409 si aparece un duplicado al confirmar', async () => {
      servidoresService.validarDuplicados
        .mockResolvedValueOnce(undefined) // previsualización renglón 2
        .mockResolvedValueOnce(undefined) // previsualización renglón 3
        .mockRejectedValueOnce(
          new ConflictException('Ya existe un servidor público con esa CURP'),
        );
      servidorModel.create.mockResolvedValue({ id: 10 });

      const error = await service
        .confirmar(dosValidas(), 1)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).message).toContain('Renglón 2');
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
