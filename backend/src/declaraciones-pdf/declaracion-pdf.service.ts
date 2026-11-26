import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { PdfService } from '../documentos/pdf.service';
import { PlantillasService } from '../documentos/plantillas.service';
import {
  armarAclaraciones,
  arbolAclaraciones,
  CLAVES_SOLO_COMPLETA,
  SECCIONES_ACLARACION,
} from './aclaraciones';
import { compilarBlade, Nodo, renderizarNodos } from './blade/blade';
import { compararPhp, escaparHtml } from './blade/php';
import type { Modelo } from './blade/valores';
import { CargadorEloquent } from './eloquent/cargador';
import type { Arbol } from './eloquent/tipos';
import { relacionesUsadas, unirArboles } from './eloquent/uso-relaciones';

export type VistaDeclaracion = 'index' | 'indexc' | 'indexp' | 'indexcp';

export const NOMBRE_PDF = 'declaracion.pdf';

const TIPO_MOVIMIENTO_INTERESES = 5;
const FUENTE = "helvetica, Arial, 'Liberation Sans', sans-serif";

/**
 * Vista que elegía el controlador: el nivel del cargo (primeros dos caracteres)
 * decide entre la versión reducida y la completa. En la pública el nivel 25 cae en
 * la reducida; en la privada, en la completa (así estaba en el sistema anterior).
 * La comparación sigue las reglas de PHP 8 (cadena contra número).
 */
export function elegirVista(
  nivelCargo: string | null | undefined,
  privada: boolean,
): VistaDeclaracion {
  const rest = (nivelCargo ?? '').trim().slice(0, 2);
  const limite = privada
    ? compararPhp(rest, 25) < 0
    : compararPhp(rest, 25) <= 0;
  const reducida =
    limite || (compararPhp(rest, 44) >= 0 && compararPhp(rest, 46) < 0);
  if (privada) return reducida ? 'indexcp' : 'indexp';
  return reducida ? 'indexc' : 'index';
}

/** Imagen del encabezado de TCPDF: x=16 mm, y=10 mm, 270 mm de ancho, en cada página. */
export function encabezadoHtml(imagenUri: string): string {
  return `<div style="position:absolute;left:0;top:0;width:297mm;height:40mm;margin:0;padding:0;"><img src="${imagenUri}" style="position:absolute;left:16mm;top:10mm;width:270mm;"></div>`;
}

/**
 * Pie de TCPDF: helvetica 8, "Página X/Y" en una celda de 548 mm que arranca en el
 * margen izquierdo (8 mm), por lo que el centro queda a 282 mm del borde izquierdo;
 * a 15 mm del borde inferior, con la celda de 10 mm de alto centrada.
 */
export function pieHtml(): string {
  return `<div style="margin:10mm 0 0 267mm;width:30mm;height:10mm;line-height:10mm;white-space:nowrap;text-align:center;font-family:${FUENTE};font-size:8pt;font-weight:normal;padding:0;">Página <span class="pageNumber"></span>/<span class="totalPages"></span></div>`;
}

export function documentoHtml(cuerpo: string, anio: number): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escaparHtml(`Declaracion patrimonial e intereses ${anio}`)}</title></head><body>${cuerpo}</body></html>`;
}

@Injectable()
export class DeclaracionPdfService {
  private readonly compiladas = new Map<
    VistaDeclaracion,
    { nodos: Nodo[]; arboles: Record<string, Arbol> }
  >();

  constructor(
    private readonly cargador: CargadorEloquent,
    private readonly plantillas: PlantillasService,
    private readonly pdf: PdfService,
    @InjectConnection('declaranet') private readonly declaranet: Sequelize,
  ) {}

  /** PDF de la declaración pública (`privada` false) o privada (true). */
  async generar(
    servidorId: number,
    declaracionId: number,
    privada: boolean,
  ): Promise<Buffer> {
    const { html, intereses } = await this.generarHtml(
      servidorId,
      declaracionId,
      privada,
    );
    const imagen = this.plantillas.imagenBase64(
      intereses
        ? 'encabezadoInteresesD.jpg'
        : privada
          ? 'encabezadod.jpg'
          : 'encabezado.jpg',
    );
    return this.pdf.generar(html, {
      formato: 'A4',
      horizontal: true,
      // SetMargins(8, 40, 15) y SetAutoPageBreak(TRUE, PDF_MARGIN_BOTTOM = 25).
      margenes: { top: '40mm', right: '15mm', bottom: '25mm', left: '8mm' },
      encabezadoHtml: encabezadoHtml(imagen),
      pieHtml: pieHtml(),
    });
  }

  /** HTML completo (sin encabezado ni pie) de la vista que corresponda. */
  async generarHtml(
    servidorId: number,
    declaracionId: number,
    privada: boolean,
  ): Promise<{ html: string; vista: VistaDeclaracion; intereses: boolean }> {
    // El nivel del cargo está en la declaración: se necesita antes de elegir la vista.
    const filas = await this.declaranet.query<{ nivel_cargo: string | null }>(
      'SELECT nivel_cargo FROM declaraciones WHERE id = :declaracionId AND servidor_publico_id = :servidorId AND deleted_at IS NULL',
      { type: QueryTypes.SELECT, replacements: { declaracionId, servidorId } },
    );
    if (filas.length === 0)
      throw new NotFoundException('Declaración no encontrada');
    const vista = elegirVista(filas[0].nivel_cargo, privada);
    const { nodos, arboles } = this.compilar(vista);

    const arbolDeclaracion = unirArboles(
      structuredClone(arboles['declaracion']),
      arbolAclaraciones(),
    );
    const declaracion = await this.cargador.buscar(
      'Declaracion',
      { id: declaracionId, servidor_publico_id: servidorId },
      arbolDeclaracion,
    );
    const servidor = await this.cargador.buscar(
      'ServidorPublico',
      { id: servidorId },
      arboles['servidor'],
    );
    if (!declaracion || !servidor) {
      throw new NotFoundException('Declaración no encontrada');
    }

    const intereses =
      Number(declaracion.atributos['tipo_movimiento_id']) ===
      TIPO_MOVIMIENTO_INTERESES;

    const aclaraciones = armarAclaraciones(
      declaracion,
      await this.respaldoDeAclaraciones(declaracionId),
    );
    if (vista === 'indexc' || vista === 'indexcp') {
      for (const clave of CLAVES_SOLO_COMPLETA) delete aclaraciones[clave];
    }

    const entregada = this.textoEstatus(declaracion) === 'Enviada';
    const html = renderizarNodos(nodos, {
      vars: {
        declaracion,
        servidor,
        aclaraciones,
        estatus: entregada
          ? ' - Declaración entregada.'
          : ' - Declaración pendiente de entregar.',
        estatusAclaracion: declaracion.atributos['fecha_envio_aclaracion']
          ? ' - Aclaración entregada.'
          : ' - Aclaración pendiente de entregar.',
      },
      sesion: { intereses },
    });
    return {
      html: documentoHtml(html, new Date().getFullYear()),
      vista,
      intereses,
    };
  }

  private textoEstatus(declaracion: Modelo): string {
    const e = declaracion.relaciones.get('estatus_declaracion') as
      Modelo | null | undefined;
    const estatus = e?.atributos['estatus'];
    return typeof estatus === 'string' ? estatus : '';
  }

  /**
   * Respaldo del sistema anterior: si el primer registro no trae aclaración, se busca
   * una de ese tipo ligada al id de la declaración. La primera por tipo.
   */
  private async respaldoDeAclaraciones(
    declaracionId: number,
  ): Promise<Map<string, string | null>> {
    const tipos = SECCIONES_ACLARACION.flatMap((s) =>
      s.respaldo ? [s.respaldo] : [],
    );
    const filas = await this.declaranet.query<{
      aclaracionable_type: string;
      observaciones: string | null;
    }>(
      'SELECT aclaracionable_type, observaciones FROM aclaraciones WHERE aclaracionable_id = :declaracionId AND aclaracionable_type IN (:tipos) AND deleted_at IS NULL ORDER BY id',
      { type: QueryTypes.SELECT, replacements: { declaracionId, tipos } },
    );
    const mapa = new Map<string, string | null>();
    for (const f of filas) {
      if (!mapa.has(f.aclaracionable_type)) {
        mapa.set(f.aclaracionable_type, f.observaciones);
      }
    }
    return mapa;
  }

  private compilar(vista: VistaDeclaracion) {
    let compilada = this.compiladas.get(vista);
    if (!compilada) {
      const nodos = compilarBlade(
        this.plantillas.cargar(`declaracion/${vista}.blade`),
      );
      compilada = {
        nodos,
        arboles: relacionesUsadas(nodos, {
          declaracion: 'Declaracion',
          servidor: 'ServidorPublico',
        }),
      };
      this.compiladas.set(vista, compilada);
    }
    return compilada;
  }
}
