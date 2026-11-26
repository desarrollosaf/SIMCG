import { Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'fs';
import { mkdir, stat, unlink, writeFile } from 'fs/promises';
import * as path from 'path';

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export function contentTypeDe(nombre: string): string {
  return (
    CONTENT_TYPES[path.extname(nombre).toLowerCase()] ??
    'application/octet-stream'
  );
}

/** Valor del encabezado Content-Disposition con filename y filename* (UTF-8). */
export function dispositionDe(
  nombre: string,
  tipo: 'attachment' | 'inline',
): string {
  const respaldo = nombre.replace(/[^\x20-\x7e]|["\\]/g, '_');
  return `${tipo}; filename="${respaldo}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;
}

@Injectable()
export class ArchivosService {
  constructor(private readonly config: ConfigService) {}

  get directorio(): string {
    return this.config.get<string>('archivos.dir') ?? '/app/uploads';
  }

  /** Ruta absoluta de un archivo guardado; null si se sale de ARCHIVOS_DIR. */
  resolverRuta(ruta: string): string | null {
    const base = path.resolve(this.directorio);
    const completa = path.resolve(base, ruta);
    const relativa = path.relative(base, completa);
    if (
      relativa === '' ||
      relativa.startsWith('..') ||
      path.isAbsolute(relativa)
    ) {
      return null;
    }
    return completa;
  }

  async existe(ruta: string | null | undefined): Promise<boolean> {
    if (!ruta) return false;
    const completa = this.resolverRuta(ruta);
    if (!completa) return false;
    try {
      return (await stat(completa)).isFile();
    } catch {
      return false;
    }
  }

  /** Guarda un buffer en `<ARCHIVOS_DIR>/<subcarpeta>/<nombre>`; devuelve la ruta relativa. */
  async guardar(
    subcarpeta: string,
    nombre: string,
    buffer: Buffer,
  ): Promise<string> {
    const relativa = `${subcarpeta}/${nombre}`;
    const completa = this.resolverRuta(relativa);
    if (!completa) throw new Error('Ruta de archivo no válida');
    await mkdir(path.dirname(completa), { recursive: true });
    await writeFile(completa, buffer);
    return relativa;
  }

  /** Borra un archivo guardado; ignora si no existe o la ruta no es válida. */
  async eliminar(ruta: string): Promise<void> {
    const completa = this.resolverRuta(ruta);
    if (completa) await unlink(completa).catch(() => undefined);
  }

  async descargar(
    ruta: string | null | undefined,
    disposicion: 'attachment' | 'inline' = 'attachment',
  ): Promise<StreamableFile> {
    const completa = ruta ? this.resolverRuta(ruta) : null;
    if (!completa || !(await this.existe(ruta))) {
      throw new NotFoundException('Archivo no encontrado');
    }
    const nombre = path.basename(completa);
    return new StreamableFile(createReadStream(completa), {
      type: contentTypeDe(nombre),
      disposition: dispositionDe(nombre, disposicion),
    });
  }
}
