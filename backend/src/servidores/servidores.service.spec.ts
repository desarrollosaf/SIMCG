import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import { Op } from 'sequelize';
import { Declaracion } from '../database/models/declaracion.model';
import { Respuesta } from '../database/models/respuesta.model';
import { ServidorPublico } from '../database/models/servidor-publico.model';
import { TipoDepartamento } from '../database/models/tipo-departamento.model';
import { TipoDependencia } from '../database/models/tipo-dependencia.model';
import { TipoDireccion } from '../database/models/tipo-direccion.model';
import { TipoMovimientoMcg } from '../database/models/tipo-movimiento-mcg.model';
import { User } from '../database/models/user.model';
import { ActualizarServidorDto } from './dto/actualizar-servidor.dto';
import { CrearServidorDto } from './dto/crear-servidor.dto';
import { BitacoraService } from './bitacora.service';
import { ServidoresService } from './servidores.service';

describe('ServidoresService', () => {
  let service: ServidoresService;

  const transaction = {
    commit: jest.fn(),
    rollback: jest.fn(),
  };
  const sequelize = {
    transaction: jest.fn((cb?: (t: unknown) => unknown) =>
      cb ? cb(transaction) : Promise.resolve(transaction),
    ),
  };
  const servidorModel = {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    findAndCountAll: jest.fn(),
  };
  const userModel = { findOne: jest.fn() };
  const dependenciaModel = { findByPk: jest.fn() };
  const direccionModel = { findByPk: jest.fn() };
  const departamentoModel = { findByPk: jest.fn() };
  const tipoMovimientoModel = { findByPk: jest.fn(), findAll: jest.fn() };
  const respuestaModel = { findByPk: jest.fn() };
  const query = jest.fn();
  const bitacora = { registrar: jest.fn() };
  const declaracionModel = {
    create: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    sequelize: { query },
  };

  const dto: CrearServidorDto = {
    nombre: 'ANA',
    primerApellido: 'LOPEZ',
    segundoApellido: null,
    rfc: 'LOPA010101',
    homoclave: 'AB1',
    curp: 'LOPA010101MMCPNA09',
    cargo: 'ANALISTA',
    nivelCargo: '25-1',
    cveIssemym: null,
    tipoDependenciaId: 3,
    tipoDireccionId: 7,
    tipoDepartamentoId: null,
    honorarios: 2,
    fechaInicio: '2025-01-01',
    tipoMovimientoId: 1,
    fechaDeclaracion: '2025-01-15',
  };

  const servidorGuardado = { id: 50, ...dto };

  beforeEach(async () => {
    jest.resetAllMocks();
    sequelize.transaction.mockImplementation((cb?: (t: unknown) => unknown) =>
      cb ? cb(transaction) : Promise.resolve(transaction),
    );
    transaction.rollback.mockResolvedValue(undefined);
    dependenciaModel.findByPk.mockResolvedValue({ id: 3 });
    direccionModel.findByPk.mockResolvedValue({ id: 7, dependenciaId: 3 });
    respuestaModel.findByPk.mockResolvedValue({ id: 2 });
    tipoMovimientoModel.findByPk.mockResolvedValue({ id: 1 });
    servidorModel.findOne.mockResolvedValue(null);

    const modulo = await Test.createTestingModule({
      providers: [
        ServidoresService,
        { provide: getConnectionToken(), useValue: sequelize },
        { provide: getModelToken(ServidorPublico), useValue: servidorModel },
        { provide: getModelToken(User), useValue: userModel },
        { provide: getModelToken(TipoDependencia), useValue: dependenciaModel },
        { provide: getModelToken(TipoDireccion), useValue: direccionModel },
        {
          provide: getModelToken(TipoDepartamento),
          useValue: departamentoModel,
        },
        {
          provide: getModelToken(TipoMovimientoMcg),
          useValue: tipoMovimientoModel,
        },
        { provide: getModelToken(Respuesta), useValue: respuestaModel },
        {
          provide: getModelToken(Declaracion, 'declaranet'),
          useValue: declaracionModel,
        },
        { provide: BitacoraService, useValue: bitacora },
      ],
    }).compile();
    service = modulo.get(ServidoresService);
  });

  describe('listar', () => {
    const fila = (id: number, extra: object = {}) => ({
      id,
      nombre: 'ANA',
      primerApellido: 'LOPEZ',
      segundoApellido: 'DIAZ',
      curp: `CURP${id}`,
      deletedAt: null,
      dependencia: { nombre: 'DEP' },
      direccion: { nombre: 'DIR' },
      ...extra,
    });

    const ultimasOpciones = () =>
      (
        servidorModel.findAndCountAll.mock.calls as unknown as [
          { paranoid: boolean; where: Record<symbol, unknown[]> },
        ][]
      )[0][0];

    beforeEach(() => {
      tipoMovimientoModel.findAll.mockResolvedValue([
        { id: 1, valor: 'INGRESO' },
        { id: 3, valor: 'MODIFICACION' },
      ]);
      declaracionModel.findAll.mockResolvedValue([]);
    });

    it('devuelve último movimiento y estatus por fila', async () => {
      servidorModel.findAndCountAll.mockResolvedValue({
        count: 3,
        rows: [fila(1), fila(2), fila(3, { deletedAt: new Date() })],
      });
      declaracionModel.findAll.mockResolvedValue([
        // más reciente primero: el segundo del mismo servidor se ignora
        {
          servidorPublicoId: 1,
          tipoMovimientoId: 3,
          fechaDeclaracion: '2026-03-12',
          obligado: true,
        },
        {
          servidorPublicoId: 1,
          tipoMovimientoId: 1,
          fechaDeclaracion: '2025-01-01',
          obligado: false,
        },
        {
          servidorPublicoId: 2,
          tipoMovimientoId: 1,
          fechaDeclaracion: '2025-02-02',
          obligado: false,
        },
      ]);

      const r = await service.listar({ inicio: 0, limite: 10 });

      expect(r.total).toBe(3);
      expect(r.filas[0]).toEqual(
        expect.objectContaining({
          nombre: 'ANA LOPEZ DIAZ',
          estatus: 'obligado',
          obligado: true,
          ultimoMovimiento: { tipo: 'MODIFICACION', fecha: '2026-03-12' },
        }),
      );
      expect(r.filas[1].estatus).toBe('no_obligado');
      expect(r.filas[2]).toEqual(
        expect.objectContaining({ estatus: 'baja', ultimoMovimiento: null }),
      );
    });

    it('mapea las declaraciones al servidor por servidorPublicoId (ids como texto o número)', async () => {
      servidorModel.findAndCountAll.mockResolvedValue({
        count: 2,
        rows: [fila(625), fila(850)],
      });
      declaracionModel.findAll.mockResolvedValue([
        {
          servidorPublicoId: '625',
          tipoMovimientoId: '3',
          fechaDeclaracion: '2026-05-01',
          obligado: 1,
        },
        {
          servidorPublicoId: 850,
          tipoMovimientoId: 1,
          fechaDeclaracion: '2021-08-31',
          obligado: 0,
        },
      ]);

      const r = await service.listar({});

      // Se consulta declaranet con los ids de cddiputados de la página.
      const consultaDeclaraciones = (
        declaracionModel.findAll.mock.calls as unknown as [
          { where: { servidorPublicoId: number[] } },
        ][]
      )[0][0];
      expect(consultaDeclaraciones.where.servidorPublicoId).toEqual([625, 850]);
      expect(r.filas[0]).toEqual(
        expect.objectContaining({
          estatus: 'obligado',
          ultimoMovimiento: { tipo: 'MODIFICACION', fecha: '2026-05-01' },
        }),
      );
      expect(r.filas[1]).toEqual(
        expect.objectContaining({
          estatus: 'no_obligado',
          ultimoMovimiento: { tipo: 'INGRESO', fecha: '2021-08-31' },
        }),
      );
    });

    it('el SQL de obligado usa servidor_publico_id y excluye intereses', async () => {
      query.mockResolvedValue([]);
      servidorModel.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
      await service.listar({ obligado: true });
      const [sql, opciones] = query.mock.calls[0] as [
        string,
        { replacements: { intereses: number; obligado: number } },
      ];
      expect(sql).toContain('d.servidor_publico_id');
      expect(sql).toContain('d.tipo_movimiento_id <> :intereses');
      expect(sql).toContain('d.deleted_at IS NULL');
      expect(opciones.replacements).toEqual({ intereses: 5, obligado: 1 });
    });

    it('marca sin_movimiento al servidor sin declaraciones', async () => {
      servidorModel.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: [fila(9)],
      });
      const r = await service.listar({});
      expect(r.filas[0].estatus).toBe('sin_movimiento');
      expect(r.filas[0].obligado).toBeNull();
    });

    it('no consulta declaraciones si la página viene vacía', async () => {
      servidorModel.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
      await service.listar({});
      expect(declaracionModel.findAll).not.toHaveBeenCalled();
    });

    it('por defecto lista solo activos y filtra por dependencia', async () => {
      servidorModel.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
      await service.listar({ dependenciaId: 4 });
      const opciones = ultimasOpciones();
      expect(opciones.paranoid).toBe(true);
      expect(opciones.where[Op.and]).toContainEqual({ tipoDependenciaId: 4 });
    });

    it('estatus baja incluye borrados y solo los dados de baja', async () => {
      servidorModel.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
      await service.listar({ estatus: 'baja' });
      const opciones = ultimasOpciones();
      expect(opciones.paranoid).toBe(false);
      expect(opciones.where[Op.and]).toContainEqual({
        deletedAt: { [Op.ne]: null },
      });
    });

    it('filtra por obligado usando el último movimiento', async () => {
      query.mockResolvedValue([
        { servidor_publico_id: '5' },
        { servidor_publico_id: '8' },
      ]);
      servidorModel.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
      await service.listar({ obligado: false });
      expect(
        (
          query.mock.calls[0] as [
            string,
            { replacements: { obligado: number } },
          ]
        )[1].replacements.obligado,
      ).toBe(0);
      const opciones = ultimasOpciones();
      expect(opciones.where[Op.and]).toContainEqual({
        id: { [Op.in]: [5, 8] },
      });
    });

    it('con obligado sin coincidencias no deja IN vacío', async () => {
      query.mockResolvedValue([]);
      servidorModel.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
      await service.listar({ obligado: true });
      const opciones = ultimasOpciones();
      expect(opciones.where[Op.and]).toContainEqual({ id: { [Op.in]: [0] } });
    });
    it('obligado implica activos aunque se pida baja o todos', async () => {
      query.mockResolvedValue([{ servidor_publico_id: '5' }]);
      servidorModel.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
      await service.listar({ obligado: true, estatus: 'baja' });
      const opciones = ultimasOpciones();
      expect(opciones.paranoid).toBe(true);
      expect(opciones.where[Op.and]).toEqual([{ id: { [Op.in]: [5] } }]);
      await service.listar({ obligado: true, estatus: 'todos' });
      expect(ultimasOpciones().paranoid).toBe(true);
    });

    it('ordena por dependencia', async () => {
      servidorModel.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
      await service.listar({ ordenar: 'dependencia', direccion: 'desc' });
      const [orden] = ultimasOpciones().order as [{ val: string }, unknown];
      expect(orden.val).toContain('`dependencia`.`nombre` DESC');
    });
  });

  describe('crear', () => {
    const preparaExito = () => {
      servidorModel.create.mockResolvedValue(servidorGuardado);
      declaracionModel.create.mockResolvedValue({
        id: 900,
        destroy: jest.fn(),
      });
      // detalle() final
      servidorModel.findByPk.mockResolvedValue({
        ...servidorGuardado,
        presentaVersionLarga: false,
      });
      userModel.findOne.mockResolvedValue(null);
    };

    it('crea el servidor y su declaración inicial y confirma', async () => {
      preparaExito();

      const resultado = await service.crear(dto, 1);

      expect(servidorModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          curp: dto.curp,
          rfc: dto.rfc,
          fechaInicio: '2025-01-01',
          tipoDependenciaId: 3,
        }),
        { transaction },
      );
      expect(declaracionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          servidorPublicoId: 50,
          tipoMovimientoId: 1,
          fechaDeclaracion: '2025-01-15',
          estatusDeclaracionId: 1,
          honorarios: 2,
        }),
      );
      expect(transaction.commit).toHaveBeenCalled();
      expect(transaction.rollback).not.toHaveBeenCalled();
      expect(resultado.id).toBe(50);
    });

    it('responde 409 si la CURP ya existe y no crea nada', async () => {
      servidorModel.findOne.mockResolvedValue({ curp: dto.curp, rfc: 'OTRO' });

      await expect(service.crear(dto, 1)).rejects.toThrow(
        new ConflictException('Ya existe un servidor público con esa CURP'),
      );
      expect(servidorModel.create).not.toHaveBeenCalled();
      expect(declaracionModel.create).not.toHaveBeenCalled();
      expect(transaction.rollback).toHaveBeenCalled();
    });

    it('responde 409 si el RFC con homoclave ya existe', async () => {
      servidorModel.findOne.mockResolvedValue({
        curp: 'OTRACURP',
        rfc: dto.rfc,
      });

      await expect(service.crear(dto, 1)).rejects.toThrow(
        new ConflictException(
          'Ya existe un servidor público con ese RFC y homoclave',
        ),
      );
    });

    it('si falla la declaración hace rollback del servidor (compensación)', async () => {
      servidorModel.create.mockResolvedValue(servidorGuardado);
      declaracionModel.create.mockRejectedValue(new Error('declaranet caído'));

      await expect(service.crear(dto, 1)).rejects.toThrow('declaranet caído');
      expect(transaction.commit).not.toHaveBeenCalled();
      expect(transaction.rollback).toHaveBeenCalled();
    });

    it('si falla el commit borra la declaración ya creada', async () => {
      const declaracion = {
        id: 900,
        destroy: jest.fn().mockResolvedValue(undefined),
      };
      servidorModel.create.mockResolvedValue(servidorGuardado);
      declaracionModel.create.mockResolvedValue(declaracion);
      transaction.commit.mockRejectedValue(new Error('commit falló'));

      await expect(service.crear(dto, 1)).rejects.toThrow('commit falló');
      expect(transaction.rollback).toHaveBeenCalled();
      expect(declaracion.destroy).toHaveBeenCalledWith({ force: true });
    });

    it('rechaza una dirección que no es de la dependencia', async () => {
      direccionModel.findByPk.mockResolvedValue({ id: 7, dependenciaId: 99 });

      await expect(service.crear(dto, 1)).rejects.toThrow(
        new BadRequestException('La dirección no pertenece a la dependencia'),
      );
      expect(sequelize.transaction).not.toHaveBeenCalled();
    });

    it('rechaza un departamento que no es de la dirección', async () => {
      departamentoModel.findByPk.mockResolvedValue({
        id: 11,
        dependenciaId: 3,
        direccionId: 8,
      });

      await expect(
        service.crear({ ...dto, tipoDepartamentoId: 11 }, 1),
      ).rejects.toThrow(
        new BadRequestException('El departamento no pertenece a la dirección'),
      );
    });

    it('rechaza un departamento sin dirección', async () => {
      await expect(
        service.crear(
          { ...dto, tipoDireccionId: null, tipoDepartamentoId: 11 },
          1,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza el tipo de movimiento INTERESES', async () => {
      await expect(
        service.crear({ ...dto, tipoMovimientoId: 5 }, 1),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza una respuesta de honorarios inexistente', async () => {
      respuestaModel.findByPk.mockResolvedValue(null);

      await expect(service.crear(dto, 1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('actualizar', () => {
    const dtoActualizar: ActualizarServidorDto = {
      ...dto,
      motivo: 'CORRECCION',
    };

    // Servidor tal como está en la base antes de editar.
    const servidorActual = (extra: object = {}) => ({
      id: 1,
      nombre: 'ANA',
      primerApellido: 'LOPEZ',
      segundoApellido: null,
      rfc: 'LOPA010101',
      homoclave: 'AB1',
      curp: 'LOPA010101MMCPNA09',
      cargo: 'JEFA',
      nivelCargo: '25-1',
      cveIssemym: null,
      tipoDependenciaId: 3,
      tipoDireccionId: 7,
      tipoDepartamentoId: null,
      honorarios: 2,
      fechaInicio: '2020-01-01',
      update: jest.fn(),
      ...extra,
    });

    it('responde 404 si no existe', async () => {
      servidorModel.findByPk.mockResolvedValue(null);

      await expect(service.actualizar(1, dtoActualizar, 2)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('exige motivo si hay cambios', async () => {
      const servidor = servidorActual();
      servidorModel.findByPk.mockResolvedValue(servidor);
      userModel.findOne.mockResolvedValue(null);

      await expect(
        service.actualizar(1, { ...dtoActualizar, motivo: undefined }, 2),
      ).rejects.toThrow(
        new BadRequestException('El motivo del cambio es obligatorio'),
      );
      expect(servidor.update).not.toHaveBeenCalled();
    });

    it('sin cambios no escribe ni pide motivo', async () => {
      const servidor = servidorActual({ cargo: 'ANALISTA' });
      servidorModel.findByPk.mockResolvedValue(servidor);
      userModel.findOne.mockResolvedValue(null);

      await service.actualizar(1, { ...dto, segundoApellido: '' }, 2);

      expect(servidor.update).not.toHaveBeenCalled();
      expect(bitacora.registrar).not.toHaveBeenCalled();
    });

    it('guarda y registra en la bitácora el motivo y los cambios (antes y después)', async () => {
      const servidor = servidorActual();
      servidorModel.findByPk.mockResolvedValue(servidor);
      userModel.findOne.mockResolvedValue(null);

      await service.actualizar(1, dtoActualizar, 2);

      const [consulta] = servidorModel.findOne.mock.calls[0] as [
        { where: { id?: unknown } },
      ];
      // Excluye al propio servidor al buscar duplicados.
      expect(consulta.where.id).toBeDefined();
      expect(servidor.update).toHaveBeenCalledWith(
        expect.objectContaining({ cargo: 'ANALISTA' }),
        { transaction },
      );
      expect(bitacora.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          logName: 'ServidorPublico',
          sujeto: 'servidor',
          sujetoId: 1,
          usuarioId: 2,
          propiedades: {
            motivo: 'CORRECCION',
            cambios: [
              {
                campo: 'cargo',
                etiqueta: 'Nombre del empleo, cargo o comisión',
                antes: 'JEFA',
                despues: 'ANALISTA',
              },
            ],
          },
        }),
        transaction,
      );
    });

    it('un cambio de correo exige usuario en Declaranet', async () => {
      servidorModel.findByPk.mockResolvedValue(servidorActual());
      userModel.findOne.mockResolvedValue(null);

      await expect(
        service.actualizar(1, { ...dtoActualizar, email: 'a@b.com' }, 2),
      ).rejects.toThrow(
        new BadRequestException(
          'El servidor público no tiene usuario en Declaranet',
        ),
      );
    });

    it('cambia el correo del usuario y lo deja en la lista de cambios', async () => {
      const servidor = servidorActual({ cargo: 'ANALISTA' });
      const usuario = { id: 9, email: 'viejo@b.com', update: jest.fn() };
      servidorModel.findByPk.mockResolvedValue(servidor);
      userModel.findOne
        .mockResolvedValueOnce(usuario) // usuario del servidor
        .mockResolvedValueOnce(null); // correo repetido

      await service.actualizar(
        1,
        { ...dtoActualizar, email: 'nuevo@b.com' },
        2,
      );

      expect(usuario.update).toHaveBeenCalledWith(
        { email: 'nuevo@b.com' },
        { transaction },
      );
      expect(servidor.update).toHaveBeenCalledWith(
        { cPersonal: 'nuevo@b.com' },
        { transaction },
      );
      const [entrada] = bitacora.registrar.mock.calls[0] as [
        { propiedades: { cambios: { campo: string }[] } },
      ];
      expect(entrada.propiedades.cambios.map((c) => c.campo)).toEqual([
        'email',
      ]);
    });

    it('rechaza un correo ya usado por otro usuario', async () => {
      servidorModel.findByPk.mockResolvedValue(
        servidorActual({ cargo: 'ANALISTA' }),
      );
      userModel.findOne
        .mockResolvedValueOnce({ id: 9, email: 'viejo@b.com' })
        .mockResolvedValueOnce({ id: 10 });

      await expect(
        service.actualizar(1, { ...dtoActualizar, email: 'otro@b.com' }, 2),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('en la bitácora nombra la dependencia en lugar del id', async () => {
      servidorModel.findByPk.mockResolvedValue(
        servidorActual({ cargo: 'ANALISTA', tipoDependenciaId: 2 }),
      );
      userModel.findOne.mockResolvedValue(null);
      dependenciaModel.findByPk.mockImplementation((id: number) =>
        Promise.resolve({ id, nombre: id === 2 ? 'TESORERIA' : 'SALUD' }),
      );

      await service.actualizar(1, dtoActualizar, 2);

      const [entrada] = bitacora.registrar.mock.calls[0] as [
        { propiedades: { cambios: { antes: string; despues: string }[] } },
      ];
      expect(entrada.propiedades.cambios[0]).toMatchObject({
        antes: 'TESORERIA',
        despues: 'SALUD',
      });
    });
  });

  describe('baja', () => {
    it('hace soft delete del servidor', async () => {
      const servidor = { id: 4, destroy: jest.fn() };
      servidorModel.findByPk.mockResolvedValue(servidor);
      userModel.findOne.mockResolvedValue({ id: 99 });

      await service.baja(4, 'RENUNCIA', 1);

      expect(servidor.destroy).toHaveBeenCalled();
    });

    it('no deja que un usuario dé de baja su propio servidor', async () => {
      servidorModel.findByPk.mockResolvedValue({ id: 4, destroy: jest.fn() });
      userModel.findOne.mockResolvedValue({ id: 1 });

      await expect(service.baja(4, 'RENUNCIA', 1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('cambiarVersionLarga', () => {
    it('rechaza activarla si el nivel no la permite', async () => {
      const servidor = { id: 4, nivelCargo: '12-1', update: jest.fn() };
      servidorModel.findByPk.mockResolvedValue(servidor);

      await expect(
        service.cambiarVersionLarga(4, true, 1),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(servidor.update).not.toHaveBeenCalled();
    });

    it('la activa si el nivel está entre 25 y 43', async () => {
      const servidor = { id: 4, nivelCargo: '30-2', update: jest.fn() };
      servidorModel.findByPk.mockResolvedValue(servidor);

      await service.cambiarVersionLarga(4, true, 1);

      expect(servidor.update).toHaveBeenCalledWith({
        presentaVersionLarga: true,
      });
    });

    it('siempre permite desactivarla', async () => {
      const servidor = { id: 4, nivelCargo: '12-1', update: jest.fn() };
      servidorModel.findByPk.mockResolvedValue(servidor);

      await service.cambiarVersionLarga(4, false, 1);

      expect(servidor.update).toHaveBeenCalledWith({
        presentaVersionLarga: false,
      });
    });
  });
});
