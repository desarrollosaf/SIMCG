import puppeteer from 'puppeteer-core';
import { PdfService } from './pdf.service';

jest.mock('puppeteer-core');

const lanzar = (puppeteer as unknown as { launch: jest.Mock }).launch;

describe('PdfService', () => {
  const pagina = {
    setContent: jest.fn(),
    pdf: jest.fn(),
    close: jest.fn(),
  };
  const navegador = {
    connected: true,
    newPage: jest.fn(),
    on: jest.fn(),
    close: jest.fn(),
  };
  let servicio: PdfService;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.PUPPETEER_EXECUTABLE_PATH = '/usr/bin/chromium-fake';
    navegador.connected = true;
    navegador.newPage.mockResolvedValue(pagina);
    navegador.close.mockResolvedValue(undefined);
    pagina.setContent.mockResolvedValue(undefined);
    pagina.pdf.mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    pagina.close.mockResolvedValue(undefined);
    lanzar.mockResolvedValue(navegador);
    servicio = new PdfService();
  });

  it('genera el PDF con las opciones y cierra la pestaña', async () => {
    const buffer = await servicio.generar('<p>hola</p>', {
      formato: 'letter',
      horizontal: true,
      margenes: { top: '3cm', right: '2cm', bottom: '2cm', left: '2cm' },
    });
    expect(buffer.toString()).toBe('%PDF');
    expect(lanzar).toHaveBeenCalledWith(
      expect.objectContaining({
        executablePath: '/usr/bin/chromium-fake',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      }),
    );
    expect(pagina.pdf).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'letter',
        landscape: true,
        displayHeaderFooter: false,
      }),
    );
    expect(pagina.close).toHaveBeenCalledTimes(1);
  });

  it('cierra la pestaña aunque falle la generación', async () => {
    pagina.pdf.mockRejectedValue(new Error('falla'));
    await expect(servicio.generar('<p/>', { formato: 'A4' })).rejects.toThrow(
      'falla',
    );
    expect(pagina.close).toHaveBeenCalledTimes(1);
  });

  it('reutiliza el navegador y lo relanza si se desconectó', async () => {
    await servicio.generar('<p/>', { formato: 'A4' });
    await servicio.generar('<p/>', { formato: 'A4' });
    expect(lanzar).toHaveBeenCalledTimes(1);
    navegador.connected = false;
    await servicio.generar('<p/>', { formato: 'A4' });
    expect(lanzar).toHaveBeenCalledTimes(2);
  });

  it('cierra el navegador al destruir el módulo', async () => {
    await servicio.generar('<p/>', { formato: 'A4' });
    await servicio.onModuleDestroy();
    expect(navegador.close).toHaveBeenCalled();
  });
});
