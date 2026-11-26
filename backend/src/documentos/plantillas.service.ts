import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import * as path from 'path';

const TIPOS_IMAGEN: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
};

const escaparHtml = (valor: string): string =>
  valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

@Injectable()
export class PlantillasService {
  private readonly plantillas = new Map<string, string>();
  private readonly imagenes = new Map<string, string>();

  // Carpetas hermanas de este módulo (src/ en desarrollo y pruebas, dist/ compilado).
  private readonly raiz = path.resolve(__dirname, '..');

  /**
   * Contenido de la plantilla `src/plantillas/<nombre>.html`, en caché. El nombre
   * puede llevar una subcarpeta y puntos en el archivo ("declaracion/index.blade").
   */
  cargar(nombre: string): string {
    if (!/^[\w-]+(\/[\w-]+(\.[\w-]+)*)?$/.test(nombre)) {
      throw new Error(`Nombre de plantilla no válido: ${nombre}`);
    }
    let contenido = this.plantillas.get(nombre);
    if (contenido === undefined) {
      contenido = readFileSync(
        path.join(this.raiz, 'plantillas', `${nombre}.html`),
        'utf8',
      );
      this.plantillas.set(nombre, contenido);
    }
    return contenido;
  }

  /**
   * Reemplaza `{{ clave }}` (escapando HTML) y `{{{ clave }}}` (sin escapar,
   * para fragmentos ya armados). Una clave inexistente queda vacía.
   */
  renderizar(nombre: string, datos: Record<string, unknown>): string {
    return this.cargar(nombre)
      .replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, clave: string) =>
        this.texto(datos[clave]),
      )
      .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, clave: string) =>
        escaparHtml(this.texto(datos[clave])),
      );
  }

  /** Data URI de una imagen de `src/assets/img/`. */
  imagenBase64(nombre: string): string {
    let uri = this.imagenes.get(nombre);
    if (uri === undefined) {
      const base = path.join(this.raiz, 'assets', 'img');
      const completa = path.resolve(base, nombre);
      if (path.relative(base, completa).startsWith('..')) {
        throw new Error(`Imagen no válida: ${nombre}`);
      }
      const tipo =
        TIPOS_IMAGEN[path.extname(nombre).toLowerCase()] ??
        'application/octet-stream';
      uri = `data:${tipo};base64,${readFileSync(completa).toString('base64')}`;
      this.imagenes.set(nombre, uri);
    }
    return uri;
  }

  private texto(valor: unknown): string {
    if (valor === null || valor === undefined) return '';
    if (typeof valor === 'object') return JSON.stringify(valor);
    return typeof valor === 'string' ? valor : `${valor as number}`;
  }
}
