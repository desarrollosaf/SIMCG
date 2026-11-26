import { existsSync } from 'fs';

/**
 * Ruta del ejecutable de Chromium para puppeteer-core. En Docker se define con
 * PUPPETEER_EXECUTABLE_PATH; sin variable se busca en las rutas habituales.
 */
export function rutaChromium(): string {
  const definida = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (definida) return definida;

  const candidatos = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];
  const encontrado = candidatos.find((ruta) => existsSync(ruta));
  if (!encontrado) {
    throw new Error(
      'No se encontró Chrome/Chromium. Define PUPPETEER_EXECUTABLE_PATH.',
    );
  }
  return encontrado;
}
