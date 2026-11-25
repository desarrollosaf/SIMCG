import { BadRequestException } from '@nestjs/common';
import {
  decodificar,
  detectarDelimitador,
  generarCsv,
  leerCsv,
  normalizarEncabezado,
  parsearFecha,
} from './csv';

const archivo = (contenido: string | Buffer, nombre = 'datos.csv') => ({
  buffer: Buffer.isBuffer(contenido) ? contenido : Buffer.from(contenido),
  originalname: nombre,
});

const opciones = {
  requeridas: ['nombre', 'fecha_inicio'],
  opcionales: ['nota'],
  alias: { fecha_de_inicio: 'fecha_inicio' },
};

describe('csv', () => {
  describe('normalizarEncabezado', () => {
    it('quita acentos, pasa a minúsculas y convierte espacios y guiones', () => {
      expect(normalizarEncabezado('  Fecha de Inicio ')).toBe(
        'fecha_de_inicio',
      );
      expect(normalizarEncabezado('Primer-Apellido')).toBe('primer_apellido');
      expect(normalizarEncabezado('MODIFICACIÓN')).toBe('modificacion');
    });
  });

  describe('decodificar', () => {
    it('quita el BOM de UTF-8', () => {
      const buffer = Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        Buffer.from('nombre,ñ'),
      ]);
      expect(decodificar(buffer)).toBe('nombre,ñ');
    });

    it('usa latin1 cuando no es UTF-8 válido (Excel en español)', () => {
      expect(decodificar(Buffer.from('MUÑOZ', 'latin1'))).toBe('MUÑOZ');
    });
  });

  describe('detectarDelimitador', () => {
    it('detecta ; y , por el encabezado', () => {
      expect(detectarDelimitador('a;b;c\n1,2;3')).toBe(';');
      expect(detectarDelimitador('a,b,c\n1;2;3')).toBe(',');
    });
  });

  describe('leerCsv', () => {
    it('lee por nombre de columna sin importar el orden y con alias', () => {
      const { filas } = leerCsv(
        archivo('Fecha de Inicio,Nombre,Extra\r\n01/02/2020,ANA,x\r\n'),
        opciones,
      );
      expect(filas).toEqual([
        {
          renglon: 2,
          valores: { fecha_inicio: '01/02/2020', nombre: 'ANA' },
        },
      ]);
    });

    it('acepta ; como delimitador y campos entre comillas', () => {
      const { filas } = leerCsv(
        archivo(
          'nombre;fecha_inicio;nota\n"PEREZ; JUAN";2020-01-01;"dijo ""hola"""\n',
        ),
        opciones,
      );
      expect(filas[0].valores).toEqual({
        nombre: 'PEREZ; JUAN',
        fecha_inicio: '2020-01-01',
        nota: 'dijo "hola"',
      });
    });

    it('respeta saltos de línea dentro de comillas y la numeración', () => {
      const { filas } = leerCsv(
        archivo(
          'nombre,fecha_inicio,nota\n\nANA,2020-01-01,"linea1\nlinea2"\n,,\nLUIS,2020-02-02,\n',
        ),
        opciones,
      );
      expect(filas.map((f) => f.renglon)).toEqual([3, 6]);
      expect(filas[0].valores.nota).toBe('linea1\nlinea2');
      expect(filas[1].valores.nombre).toBe('LUIS');
    });

    it('maneja BOM y CRLF', () => {
      const buffer = Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        Buffer.from('nombre,fecha_inicio\r\nANA,2020-01-01\r\n'),
      ]);
      const { filas } = leerCsv(archivo(buffer), opciones);
      expect(filas).toHaveLength(1);
      expect(filas[0].renglon).toBe(2);
    });

    it('lee latin1', () => {
      const { filas } = leerCsv(
        archivo(Buffer.from('nombre;fecha_inicio\nMUÑOZ;2020-01-01', 'latin1')),
        opciones,
      );
      expect(filas[0].valores.nombre).toBe('MUÑOZ');
    });

    it('lista las columnas obligatorias que faltan', () => {
      expect(() => leerCsv(archivo('otra,nota\n1,2'), opciones)).toThrow(
        'Faltan columnas obligatorias en el archivo: nombre, fecha_inicio',
      );
    });

    it('rechaza archivo vacío, sin datos, sin extensión .csv y demasiado grande', () => {
      expect(() => leerCsv(archivo(''), opciones)).toThrow(BadRequestException);
      expect(() => leerCsv(archivo('nombre,fecha_inicio\n'), opciones)).toThrow(
        'no tiene renglones de datos',
      );
      expect(() =>
        leerCsv(archivo('nombre,fecha_inicio\na,b', 'datos.xlsx'), opciones),
      ).toThrow('.csv');
      expect(() => leerCsv(undefined, opciones)).toThrow(BadRequestException);
      expect(() =>
        leerCsv(archivo(Buffer.alloc(5 * 1024 * 1024 + 1, 'a')), opciones),
      ).toThrow('5 MB');
    });

    it('rechaza más de 5000 renglones', () => {
      const cuerpo = Array.from({ length: 5001 }, () => 'A,2020-01-01').join(
        '\n',
      );
      expect(() =>
        leerCsv(archivo(`nombre,fecha_inicio\n${cuerpo}`), opciones),
      ).toThrow('5000');
    });
  });

  describe('parsearFecha', () => {
    it('acepta dd/mm/aaaa y aaaa-mm-dd', () => {
      expect(parsearFecha('05/03/2024')).toBe('2024-03-05');
      expect(parsearFecha('5/3/2024')).toBe('2024-03-05');
      expect(parsearFecha('2024-03-05')).toBe('2024-03-05');
    });

    it('rechaza fechas que no existen o con otro formato', () => {
      expect(parsearFecha('31/02/2024')).toBeNull();
      expect(parsearFecha('2024-13-01')).toBeNull();
      expect(parsearFecha('2023-02-29')).toBeNull();
      expect(parsearFecha('hoy')).toBeNull();
      expect(parsearFecha('')).toBeNull();
    });
  });

  describe('generarCsv', () => {
    it('antepone BOM y escapa comillas y comas', () => {
      const salida = generarCsv(['a', 'b'], [['x,y', 'dice "hola"']]);
      expect(salida.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
      expect(salida.toString('utf-8').slice(1)).toBe(
        'a,b\r\n"x,y","dice ""hola"""\r\n',
      );
    });
  });
});
