import { HttpResponse } from '@angular/common/http';

/** Descarga un blob en el navegador usando una URL temporal que se revoca al terminar. */
export function descargarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

/** Nombre de archivo del encabezado Content-Disposition, si viene. */
export function nombreDeContentDisposition(respuesta: HttpResponse<unknown>): string | null {
  const cabecera = respuesta.headers.get('Content-Disposition');
  if (!cabecera) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(cabecera);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      /* se intenta con el nombre simple */
    }
  }
  const simple = /filename="?([^";]+)"?/i.exec(cabecera);
  return simple ? simple[1].trim() : null;
}

/** Mensaje de error del backend (string o string[]), o null si no hay. */
export function mensajeDeError(err: { error?: { message?: unknown } }): string | null {
  const mensaje = err.error?.message;
  if (Array.isArray(mensaje)) return mensaje.join(' ');
  return typeof mensaje === 'string' ? mensaje : null;
}

/** True si la petición no llegó al servidor (sin red, servidor caído): status 0. */
export function esErrorDeRed(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { status?: unknown }).status === 0;
}

/** Formatea una fecha ISO (aaaa-mm-dd o con hora) como dd/mm/aaaa. */
export function formatearFecha(valor: string | null | undefined): string {
  if (!valor) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : valor;
}
