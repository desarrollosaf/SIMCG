import { StreamableFile } from '@nestjs/common';
import { dispositionDe } from './archivos.service';

export const TIPO_XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** PDF listo para devolver desde un controlador (inline por omisión). */
export function respuestaPdf(
  buffer: Buffer,
  nombre: string,
  inline = true,
): StreamableFile {
  return new StreamableFile(buffer, {
    type: 'application/pdf',
    disposition: dispositionDe(nombre, inline ? 'inline' : 'attachment'),
    length: buffer.length,
  });
}

/** Excel (.xlsx) listo para descargar desde un controlador. */
export function respuestaExcel(buffer: Buffer, nombre: string): StreamableFile {
  return new StreamableFile(buffer, {
    type: TIPO_XLSX,
    disposition: dispositionDe(nombre, 'attachment'),
    length: buffer.length,
  });
}
