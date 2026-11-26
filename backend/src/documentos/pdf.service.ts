import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer-core';
import { rutaChromium } from './chromium-path.util';

export interface OpcionesPdf {
  formato: 'letter' | 'A4';
  horizontal?: boolean;
  margenes?: { top: string; right: string; bottom: string; left: string };
  encabezadoHtml?: string;
  pieHtml?: string;
}

@Injectable()
export class PdfService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private navegador: Browser | null = null;
  private lanzando: Promise<Browser> | null = null;

  // Navegador único y perezoso; se vuelve a lanzar si se desconectó.
  private async obtenerNavegador(): Promise<Browser> {
    if (this.navegador?.connected) return this.navegador;
    if (!this.lanzando) {
      this.lanzando = puppeteer
        .launch({
          executablePath: rutaChromium(),
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })
        .then((navegador) => {
          navegador.on('disconnected', () => {
            if (this.navegador === navegador) this.navegador = null;
          });
          this.navegador = navegador;
          return navegador;
        })
        .finally(() => {
          this.lanzando = null;
        });
    }
    return this.lanzando;
  }

  async generar(html: string, opciones: OpcionesPdf): Promise<Buffer> {
    const navegador = await this.obtenerNavegador();
    const pagina = await navegador.newPage();
    try {
      await pagina.setContent(html, { waitUntil: 'load' });
      const conCabeceras = !!(opciones.encabezadoHtml || opciones.pieHtml);
      const pdf = await pagina.pdf({
        format: opciones.formato,
        landscape: opciones.horizontal ?? false,
        printBackground: true,
        margin: opciones.margenes,
        displayHeaderFooter: conCabeceras,
        headerTemplate: opciones.encabezadoHtml ?? '<span></span>',
        footerTemplate: opciones.pieHtml ?? '<span></span>',
      });
      return Buffer.from(pdf);
    } finally {
      await pagina.close().catch((error: unknown) => {
        this.logger.warn(`No se pudo cerrar la pestaña: ${String(error)}`);
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    const navegador = this.navegador;
    this.navegador = null;
    if (navegador) await navegador.close().catch(() => undefined);
  }
}
