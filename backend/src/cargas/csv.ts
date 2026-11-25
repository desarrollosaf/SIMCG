import { BadRequestException } from '@nestjs/common';

export const MAX_BYTES_CSV = 5 * 1024 * 1024;
export const MAX_FILAS_CSV = 5000;

export interface FilaCsv {
  // Número de renglón en el archivo (el encabezado suele ser el 1).
  renglon: number;
  valores: Record<string, string>;
}

export interface OpcionesCsv {
  // Columnas que deben existir (nombres canónicos, ya normalizados).
  requeridas: string[];
  // Columnas opcionales conocidas; el resto se ignora.
  opcionales?: string[];
  // Nombre alterno (normalizado) -> nombre canónico.
  alias?: Record<string, string>;
}

export interface TablaCsv {
  filas: FilaCsv[];
}

// Quita acentos, pasa a minúsculas y deja el nombre como identificador:
// "Fecha de Inicio" -> "fecha_de_inicio".
export function normalizarEncabezado(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

// Decodifica el archivo: UTF-8 (con o sin BOM) y, si no es UTF-8 válido,
// latin1 (Excel en español guarda los CSV en ANSI).
export function decodificar(buffer: Buffer): string {
  let datos = buffer;
  if (
    datos.length >= 3 &&
    datos[0] === 0xef &&
    datos[1] === 0xbb &&
    datos[2] === 0xbf
  ) {
    datos = datos.subarray(3);
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(datos);
  } catch {
    return new TextDecoder('latin1').decode(datos);
  }
}

// Elige ',' o ';' según cuál aparece más en el primer renglón con contenido.
export function detectarDelimitador(texto: string): string {
  const linea = texto.split(/\r\n|\n|\r/).find((l) => l.trim() !== '') ?? '';
  const comas = (linea.match(/,/g) ?? []).length;
  const puntos = (linea.match(/;/g) ?? []).length;
  return puntos > comas ? ';' : ',';
}

interface Registro {
  renglon: number;
  campos: string[];
}

// Analizador CSV (RFC 4180): campos entre comillas con delimitadores, comillas
// dobles escapadas y saltos de línea; CRLF, LF o CR. Los renglones totalmente
// vacíos se descartan pero cuentan para la numeración.
export function analizarRegistros(texto: string, delim: string): Registro[] {
  const registros: Registro[] = [];
  let campos: string[] = [];
  let campo = '';
  let entreComillas = false;
  let linea = 1;
  let lineaInicio = 1;
  let huboComillas = false;

  const cerrarCampo = () => {
    campos.push(campo);
    campo = '';
    huboComillas = false;
  };
  const cerrarRegistro = () => {
    cerrarCampo();
    const vacio = campos.every((c) => c.trim() === '');
    if (!vacio) registros.push({ renglon: lineaInicio, campos });
    campos = [];
  };

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          entreComillas = false;
        }
      } else {
        if (c === '\n') linea++;
        else if (c === '\r' && texto[i + 1] !== '\n') linea++;
        campo += c;
      }
      continue;
    }
    if (c === '"' && campo === '' && !huboComillas) {
      entreComillas = true;
      huboComillas = true;
    } else if (c === delim) {
      cerrarCampo();
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      cerrarRegistro();
      linea++;
      lineaInicio = linea;
    } else {
      campo += c;
    }
  }
  if (campo !== '' || campos.length > 0 || huboComillas) cerrarRegistro();
  return registros;
}

// Valida y lee un CSV por nombre de columna. Lanza 400 con mensajes en español.
export function leerCsv(
  archivo: { buffer: Buffer; originalname: string } | undefined,
  opciones: OpcionesCsv,
): TablaCsv {
  if (!archivo || !archivo.buffer) {
    throw new BadRequestException('Adjunta un archivo CSV');
  }
  if (!/\.csv$/i.test(archivo.originalname ?? '')) {
    throw new BadRequestException('El archivo debe ser un CSV (.csv)');
  }
  if (archivo.buffer.length === 0) {
    throw new BadRequestException('El archivo está vacío');
  }
  if (archivo.buffer.length > MAX_BYTES_CSV) {
    throw new BadRequestException('El archivo excede el tamaño máximo de 5 MB');
  }

  const texto = decodificar(archivo.buffer);
  const registros = analizarRegistros(texto, detectarDelimitador(texto));
  if (registros.length === 0) {
    throw new BadRequestException('El archivo está vacío');
  }

  const [encabezado, ...datos] = registros;
  const alias = opciones.alias ?? {};
  const conocidas = new Set([
    ...opciones.requeridas,
    ...(opciones.opcionales ?? []),
  ]);
  // Posición de cada columna conocida (la primera que aparezca gana).
  const posiciones = new Map<string, number>();
  encabezado.campos.forEach((crudo, indice) => {
    const normalizado = normalizarEncabezado(crudo);
    const nombre = alias[normalizado] ?? normalizado;
    if (conocidas.has(nombre) && !posiciones.has(nombre)) {
      posiciones.set(nombre, indice);
    }
  });

  const faltantes = opciones.requeridas.filter((r) => !posiciones.has(r));
  if (faltantes.length > 0) {
    throw new BadRequestException(
      `Faltan columnas obligatorias en el archivo: ${faltantes.join(', ')}`,
    );
  }
  if (datos.length === 0) {
    throw new BadRequestException('El archivo no tiene renglones de datos');
  }
  if (datos.length > MAX_FILAS_CSV) {
    throw new BadRequestException(
      `El archivo excede el máximo de ${MAX_FILAS_CSV} renglones`,
    );
  }

  const filas = datos.map((registro) => {
    const valores: Record<string, string> = {};
    for (const [nombre, indice] of posiciones) {
      valores[nombre] = (registro.campos[indice] ?? '').trim();
    }
    return { renglon: registro.renglon, valores };
  });
  return { filas };
}

// Acepta dd/mm/aaaa (sistema anterior) y aaaa-mm-dd; devuelve aaaa-mm-dd o
// null si no es una fecha real del calendario.
export function parsearFecha(valor: string): string | null {
  const texto = valor.trim();
  let anio: number, mes: number, dia: number;
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto);
  if (m) {
    dia = +m[1];
    mes = +m[2];
    anio = +m[3];
  } else {
    m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
    if (!m) return null;
    anio = +m[1];
    mes = +m[2];
    dia = +m[3];
  }
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    return null;
  }
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${anio}-${dos(mes)}-${dos(dia)}`;
}

const escaparCampo = (valor: string): string =>
  /[",\r\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;

// CSV de layout: BOM UTF-8 + encabezado + renglones, separados por coma y CRLF
// (Excel lo abre con acentos correctos).
export function generarCsv(encabezado: string[], filas: string[][]): Buffer {
  const lineas = [encabezado, ...filas].map((f) =>
    f.map(escaparCampo).join(','),
  );
  return Buffer.from('﻿' + lineas.join('\r\n') + '\r\n', 'utf-8');
}
