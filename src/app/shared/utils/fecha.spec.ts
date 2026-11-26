import { formatearFecha } from './fecha';

describe('formatearFecha', () => {
  it('da formato «12 mar 2026»', () => {
    expect(formatearFecha('2026-03-12')).toBe('12 mar 2026');
    expect(formatearFecha('2025-12-01')).toBe('1 dic 2025');
  });

  it('acepta fechas con hora y no se desfasa por zona horaria', () => {
    expect(formatearFecha('2026-01-01T00:00:00.000Z')).toBe('1 ene 2026');
  });

  it('devuelve cadena vacía si no es fecha', () => {
    expect(formatearFecha(null)).toBe('');
    expect(formatearFecha('')).toBe('');
    expect(formatearFecha('ayer')).toBe('');
    expect(formatearFecha('2026-13-01')).toBe('');
  });
});
