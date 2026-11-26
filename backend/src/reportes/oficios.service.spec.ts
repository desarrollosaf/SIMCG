import {
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import { Declaracion } from '../database/models/declaracion.model';
import { EnvioCorreo } from '../database/models/envio-correo.model';
import { ServidorPublico } from '../database/models/servidor-publico.model';
import { TipoMovimientoMcg } from '../database/models/tipo-movimiento-mcg.model';
import { User } from '../database/models/user.model';
import { CorreoService } from '../documentos/correo.service';
import { PdfService } from '../documentos/pdf.service';
import { PlantillasService } from '../documentos/plantillas.service';
import { hoyMexico } from '../servidores/movimientos.reglas';
import {
  ASUNTO_CORREO_PREVENTIVO,
  DatosOficioPreventivo,
  DatosOficioRemision,
  IMAGEN_CORREO_CONCLUSION,
  IMAGEN_CORREO_INICIAL,
  IMAGEN_ENCABEZADO_CORREO,
  OficiosService,
} from './oficios.service';

// Texto literal de remision.blade.php y preventivo.blade.php (sin variables ni condicionales).
const LITERALES_REMISION = [
  'Toluca, Estado de México,',
  'Oficio de remisión de omisos núm. CPL/DSP/MCG/',
  'L.C. Osiel Sánchez Villanueva Autoridad Investigadora de la Dirección de Situación Patrimonial de la Contraloría Del Poder Legislativo Con fundamento en lo dispuesto en los artículos 94, fracción III, y 96 de la Ley Orgánica del Poder Legislativo del Estado Libre y Soberano de México; 155, fracción VI, y 156 del Reglamento del Poder Legislativo del Estado Libre y Soberano de México; 1, 2, 6, fracción II, inciso A, 22, fracciones XVI, XVIII y XIX y 24, fracción V del Reglamento Interno de la Contraloría del Poder Legislativo del Estado Libre y Soberano de México; hago de su conocimiento que mediante oficio número',
  ', del',
  ', la Directora de Administración y Desarrollo de Personal de la Secretaría de Administración y Finanzas del Poder Legislativo del Estado de México, remitió a esta Dirección el padrón correspondiente a la relación de los servidores públicos incluyendo legisladores, que se encuentran en ejercicio de un empleo, cargo o comisión en el Poder Legislativo al',
  ', del que se desprenden los movimientos que fueron registrados en el Sistema Declara Legis net, en términos de los artículos 1, 8, 12, 13 y 14 de los Lineamientos de Funcionamiento del Sistema Declara Legis net para la presentación de las Declaraciones de Situación Patrimonial y de Intereses de los Servidores Públicos del Poder Legislativo del Estado de México, publicado el doce de mayo de dos mil veintiuno. En ese tenor, y transcurridos los plazos señalados en la Ley de Responsabilidades Administrativas del Estado de México y Municipios, en su artículo 34 fracción',
  'se consultó el Módulo de Control de Gestión del Sistema, en el cual se advirtió que la persona servidora pública',
  ', se presume fue omiso en la presentación de sus Declaraciones de Situación Patrimonial y de Intereses por',
  'dentro del plazo establecido para el cumplimiento de la obligación. Al efecto, se anexa la documentación soporte en copia cotejada:',
  'Lo que hago de su conocimiento con el fin de que, en el ámbito de su competencia, se aboque al conocimiento de los hechos, en términos de los numerales 34, fracción',
  '94, 95 fracción I y 99 de la Ley de Responsabilidades Administrativas del Estado de México y Municipios. Sin otro particular, estoy a sus órdenes para cualquier aclaración al respecto. A t e n t a m e n t e L. en D. Frinnett Argelia Delgado Pérez Directora de Situación Patrimonial de la Contraloría del Poder Legislativo del Estado de México c.c.p. Archivo FADP/MPRM/',
];

const LITERALES_PREVENTIVO = [
  'Toluca, Estado de México,',
  'Oficio de remisión de omisos núm. CPL/DSP/MCG/',
  'ADSCRITO A LA',
  'DE LA',
  'DEL PODER LEGISLATIVO DEL ESTADO DE MÉXICO P R E S E N T E Con fundamento en lo dispuesto por los artículos 108, párrafos primero y último de la Constitución Política de los Estados Unidos Mexicanos; 130 de la Constitución Política del Estado Libre y Soberano de México; 7, fracciones II y IX, 28, 32, 33, 34,',
  '35, párrafo primero, 36, 39, 44, 45, 46 y 50, fracción IV de la Ley de Responsabilidades Administrativas del Estado de México y Municipios, segundo transitorio y último párrafo del noveno transitorio; 1, 2, 3, fracción II, inciso A, 23, 24, fracciones I, II, V Y XXIV del Reglamento Interno de la Contraloría del Poder Legislativo del Estado Libre y Soberano de México, y los artículos 1 , 22, 23, 24, y 25 de los Lineamientos de Funcionamiento del Sistema Declara Legis net para la presentación de las Declaraciones de Situación Patrimonial y de Intereses de los Servidores Públicos del Poder Legislativo del Estado de México, publicado el doce de mayo de dos mil veintiuno; y el Acuerdo por el cual se establece como obligatorio el uso del sistema Declara Legis net para la presentación de las Declaraciones de Situación Patrimonial y de Intereses de los Servidores Públicos del Poder Legislativo del Estado de México, publicado en la Gaceta del Gobierno el veintinueve de abril de dos mil veintiuno; se le hace atento recordatorio con EFECTOS PREVENTIVOS con el objeto de que usted ingrese a la dirección https://declaranetlegis.gob.mx para realizar sus Declaraciones de Situación Patrimonial y de Intereses',
  '. El Sistema en línea es de fácil manejo; para resolver dudas generales puede ingresar a la página http://www.contraloriadelpoderlegislativo.gob.mx/declaraciones.html en donde vienen integrados videos y una presentación en power point en los que se explica el uso del sistema Declara Legis net o bien llamar al 7226891586. c.c.p. Archivo FADP/MPRM/',
];

// Texto plano del HTML: sin <style>, sin etiquetas, espacios normalizados.
const texto = (html: string): string =>
  html
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const HOY = hoyMexico();
const ANIO = HOY.slice(0, 4);

const servidorBase = {
  nombre: 'Juan Carlos',
  primerApellido: 'Pérez',
  segundoApellido: 'López',
  cargo: 'Analista',
  dependencia: 'Secretaría de Asuntos Parlamentarios',
  direccionId: 10,
  direccion: 'Dirección de Apoyo Legislativo',
};

const remision = (
  cambios: Partial<DatosOficioRemision> = {},
): DatosOficioRemision => ({
  servidor: servidorBase,
  tipoMovimientoId: 1,
  tipoMovimiento: 'INGRESO',
  folio: '0123',
  iniciales: 'MPR',
  hoy: '2026-11-26',
  folioDadp: 'DADP/45/2026',
  fechaOficio: '2026-11-20',
  fechaPadron: '2026-11-15',
  soporte: 'Copia del padrón',
  ...cambios,
});

const preventivo = (
  cambios: Partial<DatosOficioPreventivo> = {},
): DatosOficioPreventivo => ({
  servidor: servidorBase,
  tipoMovimientoId: 1,
  tipoMovimiento: 'INGRESO',
  folio: '0200',
  iniciales: 'MPR',
  hoy: '2026-11-26',
  fechaOficio: '2026-11-25',
  ...cambios,
});

describe('OficiosService', () => {
  let servicio: OficiosService;

  const servidorModel = { findByPk: jest.fn() };
  const userModel = { findByPk: jest.fn(), findOne: jest.fn() };
  const tipoMovimientoModel = { findByPk: jest.fn() };
  const envioCorreoModel = { findOne: jest.fn(), create: jest.fn() };
  const declaracionModel = { findByPk: jest.fn() };
  const pdf = { generar: jest.fn() };
  const correo = { enviar: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const modulo = await Test.createTestingModule({
      providers: [
        OficiosService,
        PlantillasService,
        { provide: PdfService, useValue: pdf },
        { provide: CorreoService, useValue: correo },
        { provide: getModelToken(ServidorPublico), useValue: servidorModel },
        { provide: getModelToken(User), useValue: userModel },
        {
          provide: getModelToken(TipoMovimientoMcg),
          useValue: tipoMovimientoModel,
        },
        { provide: getModelToken(EnvioCorreo), useValue: envioCorreoModel },
        {
          provide: getModelToken(Declaracion, 'declaranet'),
          useValue: declaracionModel,
        },
      ],
    }).compile();
    servicio = modulo.get(OficiosService);
  });

  describe('HTML del oficio de remisión', () => {
    it('contiene todos los párrafos literales del blade', () => {
      const t = texto(servicio.htmlRemision(remision()));
      for (const parrafo of LITERALES_REMISION) {
        expect(t).toContain(parrafo);
      }
    });

    it('incluye folio DADP, fechas largas, nombre, cargo y tipo en minúsculas con inicial', () => {
      const t = texto(servicio.htmlRemision(remision()));
      expect(t).toContain(
        'oficio número DADP/45/2026, del viernes 20 noviembre 2026,',
      );
      expect(t).toContain(
        'en ejercicio de un empleo, cargo o comisión en el Poder Legislativo al domingo 15 noviembre 2026,',
      );
      expect(t).toContain('Toluca, Estado de México, jueves 26 noviembre 2026');
      expect(t).toContain(
        'la persona servidora pública JUAN CARLOS PÉREZ LÓPEZ, ANALISTA, DIRECCIÓN DE APOYO LEGISLATIVO, se presume fue omiso',
      );
      expect(t).toContain(
        'Declaraciones de Situación Patrimonial y de Intereses por Ingreso dentro del plazo',
      );
      expect(t).toContain(
        'Al efecto, se anexa la documentación soporte en copia cotejada: Copia del padrón',
      );
    });

    it('número con el año actual y sin duplicar el prefijo', () => {
      const t1 = texto(
        servicio.htmlRemision(remision({ folio: '0123', hoy: HOY })),
      );
      expect(t1).toContain(
        `Oficio de remisión de omisos núm. CPL/DSP/MCG/0123/${ANIO}`,
      );
      const t2 = texto(
        servicio.htmlRemision(
          remision({ folio: 'CPL/DSP/MCG/0123', hoy: HOY }),
        ),
      );
      expect(t2).toContain(`núm. CPL/DSP/MCG/0123/${ANIO}`);
      expect(t2).not.toContain('CPL/DSP/MCG/CPL/DSP/MCG');
      const t3 = texto(
        servicio.htmlRemision(
          remision({ folio: ' cpl/dsp/mcg/77 ', hoy: '2027-01-02' }),
        ),
      );
      expect(t3).toContain('núm. CPL/DSP/MCG/77/2027');
    });

    it.each([
      [1, 'I, inciso a,', 'I, inciso a,', 'Ingreso'],
      [2, 'I, inciso b,', 'I, inciso b,', 'Reingreso'],
      [3, 'II,', 'II,', 'Modificación'],
      [4, 'III,', 'III,', 'Conclusión'],
    ])(
      'tipo de movimiento %i: fracción %s en ambos párrafos',
      (id, fraccion, final, tipo) => {
        const t = texto(
          servicio.htmlRemision(
            remision({
              tipoMovimientoId: id,
              tipoMovimiento: tipo.toUpperCase(),
            }),
          ),
        );
        expect(t).toContain(
          `en su artículo 34 fracción ${fraccion} se consultó el Módulo de Control de Gestión`,
        );
        expect(t).toContain(
          `en términos de los numerales 34, fracción ${final} 94, 95 fracción I y 99`,
        );
        expect(t).toContain(`Intereses por ${tipo} dentro del plazo`);
      },
    );

    it('otro tipo: párrafo inicial sin fracción y final cae a «III,»', () => {
      const t = texto(
        servicio.htmlRemision(
          remision({ tipoMovimientoId: 9, tipoMovimiento: 'OTRO' }),
        ),
      );
      expect(t).toContain('en su artículo 34 fracción se consultó');
      expect(t).toContain('numerales 34, fracción III, 94, 95 fracción I');
    });

    it('dirección especial 56: GRUPO PARLAMENTARIO morena', () => {
      const t = texto(
        servicio.htmlRemision(
          remision({
            servidor: {
              ...servidorBase,
              direccionId: 56,
              direccion: 'Grupo X',
            },
          }),
        ),
      );
      expect(t).toContain('ANALISTA, GRUPO PARLAMENTARIO morena, se presume');
    });

    it('dirección especial 55: GRUPO PARLAMENTARIO MOVIMIENTO CIUDADANO', () => {
      const t = texto(
        servicio.htmlRemision(
          remision({
            servidor: {
              ...servidorBase,
              direccionId: 55,
              direccion: 'Grupo Y',
            },
          }),
        ),
      );
      expect(t).toContain(
        'ANALISTA, GRUPO PARLAMENTARIO MOVIMIENTO CIUDADANO, se presume',
      );
    });

    it('destinatario fijo, firma y pie con iniciales', () => {
      const t = texto(servicio.htmlRemision(remision({ iniciales: 'JCPL' })));
      expect(t).toContain(
        'L.C. Osiel Sánchez Villanueva Autoridad Investigadora de la Dirección de Situación Patrimonial de la Contraloría Del Poder Legislativo',
      );
      expect(t).toContain(
        'A t e n t a m e n t e L. en D. Frinnett Argelia Delgado Pérez Directora de Situación Patrimonial de la Contraloría del Poder Legislativo del Estado de México',
      );
      expect(t).toContain('c.c.p. Archivo FADP/MPRM/JCPL');
    });

    it('sin segundo apellido no deja espacios sobrantes', () => {
      const t = texto(
        servicio.htmlRemision(
          remision({ servidor: { ...servidorBase, segundoApellido: null } }),
        ),
      );
      expect(t).toContain('JUAN CARLOS PÉREZ, ANALISTA');
    });

    it('escapa el contenido capturado por el usuario', () => {
      const html = servicio.htmlRemision(
        remision({ soporte: '<script>x</script>' }),
      );
      expect(html).not.toContain('<script>x</script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('HTML del oficio preventivo', () => {
    it('contiene los párrafos literales del blade', () => {
      const t = texto(servicio.htmlPreventivo(preventivo()));
      for (const parrafo of LITERALES_PREVENTIVO.filter(
        (p) => !p.startsWith('Oficio de remisión'),
      )) {
        expect(t).toContain(parrafo);
      }
    });

    it('el título dice «Oficio preventivo núm.» con el año actual', () => {
      const t = texto(servicio.htmlPreventivo(preventivo({ hoy: HOY })));
      expect(t).toContain(
        `Toluca, Estado de México, miércoles 25 noviembre 2026 Oficio preventivo núm. CPL/DSP/MCG/0200/${ANIO}`,
      );
      expect(t).not.toContain('Oficio de remisión de omisos');
      const t2 = texto(
        servicio.htmlPreventivo(
          preventivo({ folio: 'CPL/DSP/MCG/0200', hoy: HOY }),
        ),
      );
      expect(t2).not.toContain('CPL/DSP/MCG/CPL/DSP/MCG');
    });

    it('destinatario y pie', () => {
      const t = texto(
        servicio.htmlPreventivo(preventivo({ iniciales: 'ABC' })),
      );
      expect(t).toContain(
        'C. JUAN CARLOS PÉREZ LÓPEZ ADSCRITO A LA DIRECCIÓN DE APOYO LEGISLATIVO DE LA SECRETARÍA DE ASUNTOS PARLAMENTARIOS DEL PODER LEGISLATIVO DEL ESTADO DE MÉXICO P R E S E N T E',
      );
      expect(t).toContain('c.c.p. Archivo FADP/MPRM/ABC');
      expect(t).not.toContain('A t e n t a m e n t e');
    });

    it.each([1, 2, 4])(
      'tipo %i: plazo de 60 días y tipo en minúsculas',
      (id) => {
        const t = texto(
          servicio.htmlPreventivo(
            preventivo({ tipoMovimientoId: id, tipoMovimiento: 'INGRESO' }),
          ),
        );
        expect(t).toContain(
          'cuenta con 60 días naturales contados a partir del día siguiente en que la Dirección de Administración y Desarrollo de Personal registre su movimiento por declaración de ingreso, 35, párrafo primero',
        );
        expect(t).toContain('Intereses ingreso. El Sistema en línea');
        expect(t).not.toContain('del 1 al 31 de mayo');
      },
    );

    it('modificación: plazo del 1 al 31 de mayo', () => {
      const t = texto(
        servicio.htmlPreventivo(
          preventivo({ tipoMovimientoId: 3, tipoMovimiento: 'MODIFICACIÓN' }),
        ),
      );
      expect(t).toContain(
        'cuenta con el plazo del 1 al 31 de mayo del año que transcurre para realizarlo. 35, párrafo primero',
      );
      expect(t).not.toContain('60 días naturales');
      expect(t).toContain('Intereses modificación. El Sistema');
    });
  });

  describe('oficio previo', () => {
    it('devuelve el no_oficio registrado o null', async () => {
      declaracionModel.findByPk.mockResolvedValue({ id: 5 });
      envioCorreoModel.findOne.mockResolvedValueOnce({ noOficio: '0123' });
      await expect(servicio.oficioPrevio(5, 2)).resolves.toEqual({
        noOficio: '0123',
      });
      expect(envioCorreoModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { declaracionId: 5, tipoCorreo: 2 } }),
      );
      envioCorreoModel.findOne.mockResolvedValueOnce(null);
      await expect(servicio.oficioPrevio(5, 1)).resolves.toEqual({
        noOficio: null,
      });
    });

    it('404 si la declaración no existe', async () => {
      declaracionModel.findByPk.mockResolvedValue(null);
      await expect(servicio.oficioPrevio(9, 2)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('registro del oficio en envio_correos', () => {
    it('crea el registro si no existe', async () => {
      envioCorreoModel.findOne.mockResolvedValue(null);
      await servicio.registrarOficio(2, 7, 55, 'CPL/DSP/MCG/0123', 3);
      expect(envioCorreoModel.findOne).toHaveBeenCalledWith({
        where: { servidorPublicoId: 7, tipoCorreo: 2, declaracionId: 55 },
      });
      expect(envioCorreoModel.create).toHaveBeenCalledWith({
        servidorPublicoId: 7,
        declaracionId: 55,
        fechaEnvio: HOY,
        tipoCorreo: 2,
        totalOficiosGenerados: 1,
        total: 0,
        noOficio: '0123',
        idServidorRealizo: '3',
      });
    });

    it('incrementa los oficios generados si ya existe (null cuenta como 0)', async () => {
      const update = jest.fn();
      envioCorreoModel.findOne.mockResolvedValue({
        totalOficiosGenerados: 2,
        update,
      });
      await servicio.registrarOficio(1, 7, 55, '0200', 4);
      expect(update).toHaveBeenCalledWith({
        totalOficiosGenerados: 3,
        idServidorRealizo: '4',
      });
      expect(envioCorreoModel.create).not.toHaveBeenCalled();

      update.mockClear();
      envioCorreoModel.findOne.mockResolvedValue({
        totalOficiosGenerados: null,
        update,
      });
      await servicio.registrarOficio(1, 7, 55, '0200', 4);
      expect(update).toHaveBeenCalledWith({
        totalOficiosGenerados: 1,
        idServidorRealizo: '4',
      });
    });
  });

  describe('generación de PDF', () => {
    const declaracion = {
      id: 55,
      servidorPublicoId: 7,
      tipoMovimientoId: 2,
    };
    const servidorBd = {
      id: 7,
      nombre: 'Ana',
      primerApellido: 'Ruiz',
      segundoApellido: 'Gómez',
      cargo: 'Jefa',
      tipoDireccionId: 56,
      dependencia: { nombre: 'Dep' },
      direccion: { nombre: 'Dir' },
    };
    const elabora = {
      id: 3,
      nombre: 'María del Carmen',
      primerApellido: 'Pérez',
      segundoApellido: 'Rojas',
    };

    beforeEach(() => {
      declaracionModel.findByPk.mockResolvedValue(declaracion);
      tipoMovimientoModel.findByPk.mockResolvedValue({ valor: 'REINGRESO' });
      userModel.findByPk.mockResolvedValue({ id: 20, servidorPublicoId: 3 });
      servidorModel.findByPk.mockImplementation((id: number) =>
        Promise.resolve(id === 7 ? servidorBd : id === 3 ? elabora : null),
      );
      envioCorreoModel.findOne.mockResolvedValue(null);
      pdf.generar.mockResolvedValue(Buffer.from('%PDF'));
    });

    it('remisión: PDF carta con márgenes, registro y nombre de archivo', async () => {
      const r = await servicio.generarRemision(
        {
          declaracionId: 55,
          folio: 'CPL/DSP/MCG/0123',
          folioDadp: 'D-1',
          fechaOficio: '2026-11-20',
          fechaPadron: '2026-11-15',
          soporte: 'Soporte',
        },
        20,
      );
      expect(r.nombre).toBe('oficio-remision-0123.pdf');
      expect(r.buffer.toString()).toBe('%PDF');
      const [html, opciones] = pdf.generar.mock.calls[0] as [string, unknown];
      expect(opciones).toEqual({
        formato: 'letter',
        margenes: { top: '3cm', right: '2cm', bottom: '2cm', left: '2cm' },
      });
      const t = texto(html);
      expect(t).toContain('ANA RUIZ GÓMEZ, JEFA, GRUPO PARLAMENTARIO morena');
      expect(t).toContain('fracción I, inciso b,');
      // Iniciales del usuario con sesión: M d C + P + R
      expect(t).toContain('FADP/MPRM/MdCPR');
      expect(envioCorreoModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          servidorPublicoId: 7,
          declaracionId: 55,
          tipoCorreo: 2,
          noOficio: '0123',
          idServidorRealizo: '3',
        }),
      );
    });

    it('preventivo: PDF y registro tipo 1', async () => {
      const r = await servicio.generarPreventivo(
        { declaracionId: 55, folio: '0200', fechaOficio: '2026-11-25' },
        20,
      );
      expect(r.nombre).toBe('oficio-preventivo-0200.pdf');
      expect(envioCorreoModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ tipoCorreo: 1, noOficio: '0200' }),
      );
    });

    it('el folio con diagonales no rompe el nombre del archivo', async () => {
      const r = await servicio.generarPreventivo(
        { declaracionId: 55, folio: 'a/b c', fechaOficio: '2026-11-25' },
        20,
      );
      expect(r.nombre).toBe('oficio-preventivo-a-b-c.pdf');
    });

    it('404 si la declaración no existe y no registra nada', async () => {
      declaracionModel.findByPk.mockResolvedValue(null);
      await expect(
        servicio.generarPreventivo(
          { declaracionId: 1, folio: '1', fechaOficio: '2026-11-25' },
          20,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(envioCorreoModel.create).not.toHaveBeenCalled();
    });

    it('422 si el usuario no tiene servidor público', async () => {
      userModel.findByPk.mockResolvedValue({ id: 20, servidorPublicoId: 99 });
      await expect(
        servicio.generarPreventivo(
          { declaracionId: 55, folio: '1', fechaOficio: '2026-11-25' },
          20,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(pdf.generar).not.toHaveBeenCalled();
    });

    it('si el PDF falla no se registra el oficio', async () => {
      pdf.generar.mockRejectedValue(new Error('chromium'));
      await expect(
        servicio.generarPreventivo(
          { declaracionId: 55, folio: '1', fechaOficio: '2026-11-25' },
          20,
        ),
      ).rejects.toThrow('chromium');
      expect(envioCorreoModel.create).not.toHaveBeenCalled();
    });
  });

  describe('correo del oficio preventivo', () => {
    const declaracion = { id: 55, servidorPublicoId: 7, tipoMovimientoId: 1 };
    const servidorBd = {
      id: 7,
      nombre: 'Ana',
      primerApellido: 'Ruiz',
      segundoApellido: null,
      cargo: 'Jefa',
      tipoDireccionId: 10,
      dependencia: { nombre: 'Dep' },
      direccion: { nombre: 'Dir' },
    };

    const conImagenes = (existentes: string[]) =>
      jest
        .spyOn(servicio, 'rutaImagenCorreo')
        .mockImplementation((n: string) =>
          existentes.includes(n) ? `/img/${n}` : null,
        );

    beforeEach(() => {
      declaracionModel.findByPk.mockResolvedValue(declaracion);
      tipoMovimientoModel.findByPk.mockResolvedValue({ valor: 'INGRESO' });
      // El usuario 20 que envía es el servidor 3; el destinatario es el 7.
      userModel.findByPk.mockResolvedValue({ id: 20, servidorPublicoId: 3 });
      servidorModel.findByPk.mockImplementation((id: number) =>
        Promise.resolve(id === 3 ? { ...servidorBd, id: 3 } : servidorBd),
      );
      userModel.findOne.mockResolvedValue({ email: 'ana@legislativo.mx' });
      envioCorreoModel.findOne.mockResolvedValue(null);
      correo.enviar.mockResolvedValue(undefined);
    });

    it('422 «Usuario no registrado.» si el servidor no tiene usuario', async () => {
      userModel.findOne.mockResolvedValue(null);
      await expect(servicio.enviarCorreoPreventivo(55, 20)).rejects.toThrow(
        new UnprocessableEntityException('Usuario no registrado.'),
      );
      expect(correo.enviar).not.toHaveBeenCalled();
      expect(envioCorreoModel.create).not.toHaveBeenCalled();
    });

    it('404 si la declaración no existe', async () => {
      declaracionModel.findByPk.mockResolvedValue(null);
      await expect(servicio.enviarCorreoPreventivo(1, 20)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('ingreso/reingreso: asunto exacto, destinatario e imagen INICIAL por cid', async () => {
      conImagenes([
        IMAGEN_ENCABEZADO_CORREO,
        IMAGEN_CORREO_INICIAL,
        IMAGEN_CORREO_CONCLUSION,
      ]);
      await servicio.enviarCorreoPreventivo(55, 20);
      const mensaje = (correo.enviar.mock.calls as unknown[][])[0][0] as {
        para: string;
        asunto: string;
        html: string;
        adjuntos: { filename: string; cid: string; path: string }[];
      };
      expect(mensaje.asunto).toBe('Oficio Preventivo DeclaraLegisNet.');
      expect(ASUNTO_CORREO_PREVENTIVO).toBe(
        'Oficio Preventivo DeclaraLegisNet.',
      );
      expect(mensaje.para).toBe('ana@legislativo.mx');
      expect(mensaje.adjuntos.map((a) => a.filename)).toEqual([
        'IMG_MAILB.png',
        'CORREO_DECLARALEGIS_INICIAL.png',
      ]);
      expect(mensaje.adjuntos.map((a) => a.cid)).toEqual([
        'encabezado',
        'cuerpo',
      ]);
      expect(mensaje.html).toContain('cid:encabezado');
      expect(mensaje.html).toContain('cid:cuerpo');
    });

    it('reingreso también usa la imagen INICIAL', async () => {
      declaracionModel.findByPk.mockResolvedValue({
        ...declaracion,
        tipoMovimientoId: 2,
      });
      conImagenes([IMAGEN_ENCABEZADO_CORREO, IMAGEN_CORREO_INICIAL]);
      await servicio.enviarCorreoPreventivo(55, 20);
      const { adjuntos } = (correo.enviar.mock.calls as unknown[][])[0][0] as {
        adjuntos: { filename: string }[];
      };
      expect(adjuntos[1].filename).toBe('CORREO_DECLARALEGIS_INICIAL.png');
    });

    it.each([3, 4])(
      'tipo %i usa la imagen CONCLUSION',
      async (tipoMovimientoId) => {
        declaracionModel.findByPk.mockResolvedValue({
          ...declaracion,
          tipoMovimientoId,
        });
        conImagenes([IMAGEN_ENCABEZADO_CORREO, IMAGEN_CORREO_CONCLUSION]);
        await servicio.enviarCorreoPreventivo(55, 20);
        const { adjuntos } = (
          correo.enviar.mock.calls as unknown[][]
        )[0][0] as {
          adjuntos: { filename: string }[];
        };
        expect(adjuntos[1].filename).toBe('CORREO_DECLARALEGIS_CONCLUSION.png');
      },
    );

    it('si falta el PNG usa el texto del oficio preventivo y registra warning', async () => {
      conImagenes([IMAGEN_ENCABEZADO_CORREO]);
      const warn = jest
        .spyOn((servicio as unknown as { logger: Logger }).logger, 'warn')
        .mockImplementation(() => undefined);
      await servicio.enviarCorreoPreventivo(55, 20);
      const mensaje = (correo.enviar.mock.calls as unknown[][])[0][0] as {
        html: string;
        adjuntos: { filename: string }[];
      };
      expect(mensaje.adjuntos.map((a) => a.filename)).toEqual([
        'IMG_MAILB.png',
      ]);
      expect(mensaje.html).toContain('cid:encabezado');
      expect(mensaje.html).not.toContain('cid:cuerpo');
      expect(texto(mensaje.html)).toContain(
        'se le hace atento recordatorio con EFECTOS PREVENTIVOS',
      );
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('CORREO_DECLARALEGIS_INICIAL.png'),
      );
    });

    it('el respaldo muestra el número de oficio si ya se generó uno', async () => {
      conImagenes([IMAGEN_ENCABEZADO_CORREO]);
      jest
        .spyOn((servicio as unknown as { logger: Logger }).logger, 'warn')
        .mockImplementation(() => undefined);
      envioCorreoModel.findOne
        .mockResolvedValueOnce({ noOficio: '0200' })
        .mockResolvedValue(null);
      await servicio.enviarCorreoPreventivo(55, 20);
      const { html } = (correo.enviar.mock.calls as unknown[][])[0][0] as {
        html: string;
      };
      expect(texto(html)).toContain(
        `Oficio preventivo núm. CPL/DSP/MCG/0200/${ANIO}`,
      );
    });

    it('registra el envío en envio_correos filtrando por declaración (crear)', async () => {
      conImagenes([IMAGEN_ENCABEZADO_CORREO, IMAGEN_CORREO_INICIAL]);
      await servicio.enviarCorreoPreventivo(55, 20);
      expect(envioCorreoModel.findOne).toHaveBeenCalledWith({
        where: { servidorPublicoId: 7, tipoCorreo: 1, declaracionId: 55 },
      });
      expect(envioCorreoModel.create).toHaveBeenCalledWith({
        servidorPublicoId: 7,
        declaracionId: 55,
        fechaEnvio: HOY,
        tipoCorreo: 1,
        total: 1,
        totalOficiosGenerados: 0,
        idServidorRealizo: '3',
      });
    });

    it('registra el envío incrementando el total si ya existe', async () => {
      conImagenes([IMAGEN_ENCABEZADO_CORREO, IMAGEN_CORREO_INICIAL]);
      const update = jest.fn();
      envioCorreoModel.findOne.mockResolvedValue({ total: 2, update });
      await servicio.enviarCorreoPreventivo(55, 20);
      expect(update).toHaveBeenCalledWith({
        total: 3,
        idServidorRealizo: '3',
      });
      expect(envioCorreoModel.create).not.toHaveBeenCalled();
    });

    it('si el correo falla no se registra el envío', async () => {
      conImagenes([IMAGEN_ENCABEZADO_CORREO, IMAGEN_CORREO_INICIAL]);
      correo.enviar.mockRejectedValue(new Error('smtp'));
      await expect(servicio.enviarCorreoPreventivo(55, 20)).rejects.toThrow(
        'smtp',
      );
      expect(envioCorreoModel.create).not.toHaveBeenCalled();
    });
  });
});
