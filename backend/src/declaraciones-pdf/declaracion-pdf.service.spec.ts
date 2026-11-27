import { NotFoundException } from '@nestjs/common';
import { OpcionesPdf, PdfService } from '../documentos/pdf.service';
import { PlantillasService } from '../documentos/plantillas.service';
import { Modelo } from './blade/valores';
import {
  DeclaracionPdfService,
  documentoHtml,
  elegirVista,
  encabezadoHtml,
  pieHtml,
} from './declaracion-pdf.service';
import type { CargadorEloquent } from './eloquent/cargador';
import type { Arbol } from './eloquent/tipos';

const plano = (html: string) => html.replace(/\s+/g, ' ');

describe('elegirVista', () => {
  it('la pública usa la reducida hasta el nivel 25 y entre 44 y 45', () => {
    for (const nivel of ['01-1', '09-1', ' 23-1 ', '25-4', '44-1', '45-2']) {
      expect(elegirVista(nivel, false)).toBe('indexc');
    }
    for (const nivel of ['26-1', '32-1', '43-1', '46-1', '99-9']) {
      expect(elegirVista(nivel, false)).toBe('index');
    }
  });

  it('la privada usa la reducida solo por debajo de 25 (el 25 va completa)', () => {
    expect(elegirVista('24-1', true)).toBe('indexcp');
    expect(elegirVista('25-1', true)).toBe('indexp');
    expect(elegirVista('44-1', true)).toBe('indexcp');
    expect(elegirVista('45-1', true)).toBe('indexcp');
    expect(elegirVista('46-1', true)).toBe('indexp');
    expect(elegirVista('32-1', true)).toBe('indexp');
  });

  it('sin nivel cae en la reducida (cadena vacía <= 25) y "N/A" en la completa, como PHP 8', () => {
    expect(elegirVista(null, false)).toBe('indexc');
    expect(elegirVista('', true)).toBe('indexcp');
    expect(elegirVista('N/A', false)).toBe('index');
    expect(elegirVista('N/A', true)).toBe('indexp');
  });
});

describe('encabezado y pie', () => {
  it('el encabezado coloca la imagen a 16 mm, 10 mm y 270 mm de ancho', () => {
    const html = encabezadoHtml('data:image/jpeg;base64,AAA');
    expect(html).toContain('src="data:image/jpeg;base64,AAA"');
    expect(html).toContain('left:16mm;top:10mm;width:270mm');
  });

  it('el pie es "Página X/Y" en helvetica 8 centrado a 282 mm y a 10 mm del margen', () => {
    const html = pieHtml();
    expect(html).toContain(
      'Página <span class="pageNumber"></span>/<span class="totalPages"></span>',
    );
    expect(html).toContain('font-size:8pt');
    expect(html).toContain('text-align:center');
    // 267 mm + 30 mm / 2 = 282 mm.
    expect(html).toContain('margin:10mm 0 0 267mm;width:30mm');
  });

  it('el documento lleva el título con el año', () => {
    expect(documentoHtml('<p>x</p>', 2026)).toContain(
      '<title>Declaracion patrimonial e intereses 2026</title>',
    );
  });
});

describe('DeclaracionPdfService', () => {
  const plantillas = new PlantillasService();
  const pdf = {
    generar: jest.fn<Promise<Buffer>, [string, OpcionesPdf]>(),
  };
  const consulta = jest.fn<
    Promise<unknown[]>,
    [string, { replacements: Record<string, unknown> }]
  >();
  const declaranet = { query: consulta };
  const cargador = {
    buscar: jest.fn<
      Promise<Modelo | null>,
      [string, Record<string, unknown>, Arbol]
    >(),
  };
  let servicio: DeclaracionPdfService;

  const modelo = (clase: string, atributos: Record<string, unknown>) =>
    new Modelo(clase, atributos);

  beforeEach(() => {
    jest.resetAllMocks();
    servicio = new DeclaracionPdfService(
      cargador as unknown as CargadorEloquent,
      plantillas,
      pdf as unknown as PdfService,
      declaranet as never,
    );
  });

  const prepararDeclaracion = (
    tipo: number,
    nivel: string,
    extra: Record<string, unknown> = {},
  ) => {
    consulta.mockImplementation((sql) =>
      Promise.resolve(
        sql.includes('SELECT nivel_cargo') ? [{ nivel_cargo: nivel }] : [],
      ),
    );
    const declaracion = modelo('Declaracion', {
      id: 21,
      tipo_movimiento_id: tipo,
      situacion_personal_id: 1,
      fecha_declaracion: '2024-01-02',
      fecha_envio: '2024-01-03',
      ...extra,
    });
    declaracion.relaciones.set(
      'estatus_declaracion',
      modelo('EstatusDeclaracion', { estatus: 'Enviada' }),
    );
    declaracion.relaciones.set('tipo_movimiento', modelo('T', { valor: 'X' }));
    cargador.buscar.mockImplementation((clase) =>
      Promise.resolve(
        clase === 'Declaracion'
          ? declaracion
          : modelo('ServidorPublico', {
              nombre: 'ANA',
              primer_apellido: 'RUIZ',
            }),
      ),
    );
    return declaracion;
  };

  it('404 si la declaración no es del servidor', async () => {
    consulta.mockResolvedValue([]);
    await expect(servicio.generar(1, 99, false)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(consulta.mock.calls[0][1].replacements).toEqual({
      declaracionId: 99,
      servidorId: 1,
    });
    expect(cargador.buscar).not.toHaveBeenCalled();
  });

  it('404 si el servidor ya no existe', async () => {
    consulta.mockResolvedValue([{ nivel_cargo: '32-1' }]);
    cargador.buscar.mockResolvedValue(null);
    await expect(servicio.generarHtml(1, 5, false)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('elige la vista por el nivel y la declaración pública/privada', async () => {
    prepararDeclaracion(1, '32-1');
    expect((await servicio.generarHtml(1, 21, false)).vista).toBe('index');
    expect((await servicio.generarHtml(1, 21, true)).vista).toBe('indexp');
    prepararDeclaracion(1, '10-1');
    expect((await servicio.generarHtml(1, 21, false)).vista).toBe('indexc');
    expect((await servicio.generarHtml(1, 21, true)).vista).toBe('indexcp');
  });

  it('el tipo 5 se renderiza como declaración de intereses', async () => {
    prepararDeclaracion(5, '32-1');
    const r = await servicio.generarHtml(1, 21, false);
    expect(r.intereses).toBe(true);
    expect(plano(r.html)).toContain('presento mi Declaración de INTERESES');
    expect(r.html).not.toContain('DATOS GENERALES DEL DECLARANTE');
  });

  it('el estatus y la aclaración se arman como en el controlador anterior', async () => {
    prepararDeclaracion(1, '32-1', { fecha_envio_aclaracion: '2024-02-01' });
    const r = await servicio.generarHtml(1, 21, false);
    expect(plano(r.html)).toContain(
      'Folio: 0000000021 - Declaración entregada.',
    );
    expect(r.html).toContain(' - Aclaración entregada.');
    prepararDeclaracion(1, '32-1');
    const sinAcl = await servicio.generarHtml(1, 21, false);
    expect(sinAcl.html).not.toContain('<h1 align="center">ACLARACIONES</h1>');
  });

  it('una declaración sin estatus "Enviada" queda como pendiente de entregar', async () => {
    const d = prepararDeclaracion(1, '32-1');
    d.relaciones.set(
      'estatus_declaracion',
      modelo('E', { estatus: 'Terminada' }),
    );
    expect(plano((await servicio.generarHtml(1, 21, false)).html)).toContain(
      'Folio: 0000000021 - Declaración pendiente de entregar.',
    );
  });

  it('genera el PDF A4 horizontal con márgenes 8/40/15/25 y la imagen de encabezado que toca', async () => {
    prepararDeclaracion(1, '32-1');
    pdf.generar.mockResolvedValue(Buffer.from('%PDF'));
    expect(await servicio.generar(1, 21, false)).toEqual(Buffer.from('%PDF'));
    const [html, opciones] = pdf.generar.mock.calls[0];
    expect(html).toContain('<!doctype html>');
    expect(opciones).toMatchObject({
      formato: 'A4',
      horizontal: true,
      margenes: { top: '40mm', right: '15mm', bottom: '25mm', left: '8mm' },
    });
    expect(opciones.pieHtml).toContain('totalPages');

    const imagen = (nombre: string) =>
      plantillas.imagenBase64(nombre).slice(0, 4000);
    expect(opciones.encabezadoHtml).toContain(imagen('encabezado.jpg'));

    await servicio.generar(1, 21, true);
    expect(pdf.generar.mock.calls[1][1].encabezadoHtml).toContain(
      imagen('encabezadod.jpg'),
    );

    prepararDeclaracion(5, '32-1');
    await servicio.generar(1, 21, false);
    await servicio.generar(1, 21, true);
    for (const llamada of [
      pdf.generar.mock.calls[2],
      pdf.generar.mock.calls[3],
    ]) {
      expect(llamada[1].encabezadoHtml).toContain(
        imagen('encabezadoInteresesD.jpg'),
      );
    }
  });

  it('2. el respaldo de aclaraciones solo toma las que no pertenecen a un registro de la tabla del tipo', async () => {
    prepararDeclaracion(1, '32-1');
    await servicio.generarHtml(1, 21, false);
    const sql = consulta.mock.calls
      .map((c) => c[0])
      .find((s) => s.includes('NOT EXISTS'));
    expect(sql).toBeDefined();
    expect(sql).toContain(
      'a.aclaracionable_type = :t0 AND NOT EXISTS (SELECT 1 FROM `datos_curriculares` h WHERE h.`id` = a.aclaracionable_id)',
    );
    expect(sql).toContain('FROM `vehiculos` h');
    const llamada = consulta.mock.calls.find((c) => c[0] === sql);
    expect(llamada?.[1].replacements).toMatchObject({
      declaracionId: 21,
      t0: 'App\\DatoCurricular',
    });
  });

  it('precarga también lo que se necesita para las aclaraciones', async () => {
    prepararDeclaracion(1, '32-1');
    await servicio.generarHtml(1, 21, false);
    const arbol = cargador.buscar.mock.calls[0][2];
    expect(arbol.bienes_inmuebles).toBeDefined();
    expect(arbol.viajes.aclaracionesdecl).toEqual({});
  });
});
