import { FilaReporte } from '../../core/services/reportes.service';
import {
  adscripcionSecundaria,
  envioFila,
  estatusVisual,
  filtrarFilas,
  nombreFila,
  ordenarFilas,
} from './reportes-presentacion';

const fila = (extra: Partial<FilaReporte> = {}): FilaReporte => ({
  id: 1,
  servidorId: 10,
  nombre: 'Ana',
  primerApellido: 'Ruiz',
  segundoApellido: 'Gómez',
  curp: 'RUGA800101MMCXXX01',
  cargo: 'Jefa de Unidad',
  dependencia: 'Secretaría General',
  direccion: 'Dirección de Apoyo',
  departamento: 'Departamento X',
  tipoMovimientoId: 1,
  tipoMovimiento: 'INGRESO',
  fechaDeclaracion: '2026-01-15',
  fechaEnvio: null,
  estatus: 'OMISO',
  ...extra,
});

describe('reportes-presentacion', () => {
  it('nombre completo, en mayúsculas si se pide y sin huecos', () => {
    expect(nombreFila(fila())).toBe('Ana Ruiz Gómez');
    expect(nombreFila(fila(), true)).toBe('ANA RUIZ GÓMEZ');
    expect(nombreFila(fila({ segundoApellido: null }))).toBe('Ana Ruiz');
  });

  it('dirección y departamento debajo de la dependencia', () => {
    expect(adscripcionSecundaria(fila())).toBe('Dirección de Apoyo · Departamento X');
    expect(adscripcionSecundaria(fila({ departamento: '' }), true)).toBe('DIRECCIÓN DE APOYO');
  });

  it('columna ENVÍO: «ENVIADA EL: …» o «SIN ENVIO»', () => {
    expect(envioFila(fila())).toBe('SIN ENVIO');
    expect(envioFila(fila({ fechaEnvio: '2026-03-05' }))).toBe('ENVIADA EL: 2026-03-05');
  });

  it('etiqueta de color por estatus', () => {
    expect(estatusVisual(fila())).toEqual({ texto: 'OMISO', tono: 'error' });
    expect(estatusVisual(fila({ estatus: 'ENVIO EXTEMPORANEO' }))).toEqual({
      texto: 'ENVIO EXTEMPORANEO',
      tono: 'info',
    });
    expect(estatusVisual(fila({ estatus: 'EN TIEMPO' }))).toEqual({
      texto: 'EN TIEMPO',
      tono: 'ok',
    });
  });

  it('busca sin acentos ni mayúsculas, con todas las palabras', () => {
    const filas = [fila(), fila({ id: 2, nombre: 'Luis', cargo: 'Analista', estatus: 'EN TIEMPO' })];
    expect(filtrarFilas(filas, '').length).toBe(2);
    expect(filtrarFilas(filas, 'LUIS gomez').map((f) => f.id)).toEqual([2]);
    expect(filtrarFilas(filas, 'en tiempo').map((f) => f.id)).toEqual([2]);
    expect(filtrarFilas(filas, 'secretaria general').length).toBe(2);
    expect(filtrarFilas(filas, 'zzz')).toEqual([]);
  });

  it('ordena por columna sin alterar el arreglo original', () => {
    const filas = [
      fila({ id: 1, nombre: 'Zoe' }),
      fila({ id: 2, nombre: 'Ana' }),
      fila({ id: 3, nombre: 'Mario' }),
    ];
    expect(ordenarFilas(filas, { clave: 'nombre', direccion: 'asc' }).map((f) => f.id)).toEqual([
      2, 3, 1,
    ]);
    expect(ordenarFilas(filas, { clave: 'nombre', direccion: 'desc' }).map((f) => f.id)).toEqual([
      1, 3, 2,
    ]);
    expect(ordenarFilas(filas, null)).toBe(filas);
    expect(filas.map((f) => f.id)).toEqual([1, 2, 3]);
  });
});
