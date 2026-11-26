import { fechaLarga } from './fechas-es';
import {
  direccionRemision,
  fraccionArticulo34,
  fraccionArticulo34Final,
  inicialesDe,
  nombreMayusculas,
  normalizarFolio,
  numeroOficio,
  plazoPreventivo,
  primeraMayuscula,
} from './oficios';

describe('fechaLarga', () => {
  it('usa el formato l j F Y de Jenssegers en español, en minúsculas', () => {
    expect(fechaLarga('2026-11-26')).toBe('jueves 26 noviembre 2026');
    expect(fechaLarga('2026-01-04')).toBe('domingo 4 enero 2026');
    expect(fechaLarga('2026-03-07')).toBe('sábado 7 marzo 2026');
    expect(fechaLarga('2026-12-02')).toBe('miércoles 2 diciembre 2026');
  });

  it('acepta fechas con hora', () => {
    expect(fechaLarga('2026-11-26T10:00:00.000Z')).toBe(
      'jueves 26 noviembre 2026',
    );
  });
});

describe('textos de oficio', () => {
  it('normalizarFolio quita espacios y el prefijo sin importar mayúsculas', () => {
    expect(normalizarFolio('0123')).toBe('0123');
    expect(normalizarFolio('  CPL/DSP/MCG/0123 ')).toBe('0123');
    expect(normalizarFolio('cpl/dsp/mcg/0123')).toBe('0123');
    expect(normalizarFolio('CPL/DSP/MCG/CPL/DSP/MCG/9')).toBe('CPL/DSP/MCG/9');
  });

  it('numeroOficio usa el año recibido', () => {
    expect(numeroOficio('CPL/DSP/MCG/12', '2027')).toBe('CPL/DSP/MCG/12/2027');
    expect(numeroOficio('12', '2026')).toBe('CPL/DSP/MCG/12/2026');
  });

  it('fracciones del artículo 34 por tipo', () => {
    expect(fraccionArticulo34(1)).toBe('I, inciso a,');
    expect(fraccionArticulo34(2)).toBe('I, inciso b,');
    expect(fraccionArticulo34(3)).toBe('II,');
    expect(fraccionArticulo34(4)).toBe('III,');
    expect(fraccionArticulo34(7)).toBe('');
    expect(fraccionArticulo34Final(4)).toBe('III,');
    expect(fraccionArticulo34Final(7)).toBe('III,');
    expect(fraccionArticulo34Final(1)).toBe('I, inciso a,');
  });

  it('primeraMayuscula equivale a ucfirst(mb_strtolower())', () => {
    expect(primeraMayuscula('INGRESO')).toBe('Ingreso');
    expect(primeraMayuscula('MODIFICACIÓN')).toBe('Modificación');
    expect(primeraMayuscula('ÁREA')).toBe('área');
    expect(primeraMayuscula('')).toBe('');
  });

  it('direcciones especiales 56 y 55', () => {
    expect(direccionRemision(56, 'X')).toBe('GRUPO PARLAMENTARIO morena');
    expect(direccionRemision(55, 'X')).toBe(
      'GRUPO PARLAMENTARIO MOVIMIENTO CIUDADANO',
    );
    expect(direccionRemision(1, 'Dirección uno')).toBe('DIRECCIÓN UNO');
    expect(direccionRemision(null, null)).toBe('');
  });

  it('iniciales: cada palabra del nombre + cada apellido', () => {
    expect(inicialesDe('JUAN CARLOS', 'PÉREZ', 'LÓPEZ')).toBe('JCPL');
    expect(inicialesDe('ANA', 'RUIZ', null)).toBe('AR');
    expect(inicialesDe('ANA', 'RUIZ', 'GÓMEZ')).toBe('ARG');
  });

  it('nombreMayusculas omite apellidos vacíos', () => {
    expect(nombreMayusculas('Ana', 'Ruiz', null)).toBe('ANA RUIZ');
    expect(nombreMayusculas('Ana María', 'Ruiz', 'Gómez')).toBe(
      'ANA MARÍA RUIZ GÓMEZ',
    );
  });

  it('plazo del preventivo: 60 días salvo modificación', () => {
    expect(plazoPreventivo(1, 'ingreso')).toContain('60 días naturales');
    expect(plazoPreventivo(1, 'ingreso')).toMatch(/declaración de ingreso,$/);
    expect(plazoPreventivo(4, 'conclusión')).toContain('60 días naturales');
    expect(plazoPreventivo(3, 'modificación')).toContain('del 1 al 31 de mayo');
  });
});
