import * as XLSX from 'xlsx-js-style';
import { ExcelService } from './excel.service';

describe('ExcelService', () => {
  const servicio = new ExcelService();
  const columnas = [
    { encabezado: 'Nombre', campo: 'nombre', ancho: 30 },
    { encabezado: 'Total', campo: 'total' },
  ];

  it('genera un xlsx con encabezados y filas', () => {
    const buffer = servicio.generar('Omisos', columnas, [
      { nombre: 'Ana', total: 3 },
      { nombre: 'Luis', total: null },
    ]);
    const libro = XLSX.read(buffer, { type: 'buffer' });
    expect(libro.SheetNames).toEqual(['Omisos']);
    const filas = XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets['Omisos'], {
      header: 1,
    });
    expect(filas[0]).toEqual(['Nombre', 'Total']);
    expect(filas[1]).toEqual(['Ana', 3]);
    expect(filas[2][0]).toBe('Luis');
  });

  it('aplica fondo gris y anchos al encabezado', () => {
    const buffer = servicio.generar('Hoja', columnas, []);
    const libro = XLSX.read(buffer, { type: 'buffer', cellStyles: true });
    const hoja = libro.Sheets['Hoja'];
    expect((hoja['A1'] as { s: unknown }).s).toMatchObject({
      fgColor: { rgb: 'D2D3D5' },
    });
    expect(hoja['!cols']?.[0].wch).toBe(30);
  });

  it('define negritas y bordes finos en el encabezado', () => {
    const espia = jest.spyOn(XLSX.utils, 'aoa_to_sheet');
    servicio.generar('Hoja', columnas, []);
    const [[encabezado]] = espia.mock.calls[0][0] as unknown as [
      [{ s: { font: { bold: boolean }; border: { top: { style: string } } } }],
    ];
    expect(encabezado.s.font.bold).toBe(true);
    expect(encabezado.s.border.top.style).toBe('thin');
    espia.mockRestore();
  });

  it('recorta y limpia el nombre de la hoja', () => {
    const buffer = servicio.generar('a/b'.padEnd(40, 'x'), columnas, []);
    const libro = XLSX.read(buffer, { type: 'buffer' });
    expect(libro.SheetNames[0]).toHaveLength(31);
    expect(libro.SheetNames[0]).not.toContain('/');
  });
});
