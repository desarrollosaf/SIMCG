import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx-js-style';

export interface ColumnaExcel {
  encabezado: string;
  campo: string;
  ancho?: number;
}

const BORDE = { style: 'thin', color: { rgb: '000000' } };
const BORDES = { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE };

@Injectable()
export class ExcelService {
  generar(
    hoja: string,
    columnas: ColumnaExcel[],
    filas: Record<string, unknown>[],
  ): Buffer {
    const encabezados = columnas.map((c) => ({
      v: c.encabezado,
      t: 's',
      s: {
        font: { bold: true },
        fill: { patternType: 'solid', fgColor: { rgb: 'D2D3D5' } },
        border: BORDES,
      },
    }));
    const cuerpo = filas.map((fila) =>
      columnas.map((c) => this.celda(fila[c.campo])),
    );

    const ws = XLSX.utils.aoa_to_sheet([encabezados, ...cuerpo]);
    ws['!cols'] = columnas.map((c) => ({ wch: c.ancho ?? 20 }));

    const wb = XLSX.utils.book_new();
    // Excel limita el nombre de hoja a 31 caracteres y prohíbe : \ / ? * [ ]
    const nombre = hoja.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Hoja1';
    XLSX.utils.book_append_sheet(wb, ws, nombre);
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  private celda(valor: unknown) {
    const estilo = { border: BORDES };
    if (valor === null || valor === undefined) {
      return { v: '', t: 's', s: estilo };
    }
    if (typeof valor === 'number') return { v: valor, t: 'n', s: estilo };
    if (valor instanceof Date) return { v: valor, t: 'd', s: estilo };
    return {
      v: typeof valor === 'string' ? valor : JSON.stringify(valor),
      t: 's',
      s: estilo,
    };
  }
}
