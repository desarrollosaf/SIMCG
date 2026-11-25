import {
  calcularEstatus,
  estadoObligado,
  fechaLimite,
  hoyMexico,
  permiteVersionLarga,
  sumarDias,
  tiposPermitidos,
} from './movimientos.reglas';

describe('movimientos.reglas', () => {
  describe('sumarDias / fechaLimite', () => {
    it('suma días cruzando mes y año', () => {
      expect(sumarDias('2025-12-15', 60)).toBe('2026-02-13');
    });

    it('da 60 días a ingreso, reingreso y conclusión', () => {
      expect(fechaLimite(1, '2024-01-01')).toBe('2024-03-01');
      expect(fechaLimite(4, '2024-01-01')).toBe('2024-03-01');
    });

    it('da 30 días a la modificación, y 91 si es de 2021', () => {
      expect(fechaLimite(3, '2024-05-01')).toBe('2024-05-31');
      expect(fechaLimite(3, '2021-05-01')).toBe('2021-07-31');
    });
  });

  describe('calcularEstatus', () => {
    const base = {
      tipoMovimientoId: 1,
      fechaDeclaracion: '2024-01-01',
    };

    it('sin envío y dentro del plazo: EN TIEMPO (el último día aún cuenta)', () => {
      expect(
        calcularEstatus({ ...base, fechaEnvio: null, hoy: '2024-03-01' }),
      ).toBe('EN TIEMPO');
    });

    it('sin envío y vencido: OMISO', () => {
      expect(
        calcularEstatus({ ...base, fechaEnvio: null, hoy: '2024-03-02' }),
      ).toBe('OMISO');
    });

    it('con envío dentro del plazo: ENVIO EN TIEMPO', () => {
      expect(
        calcularEstatus({
          ...base,
          fechaEnvio: '2024-03-01',
          hoy: '2024-06-01',
        }),
      ).toBe('ENVIO EN TIEMPO');
    });

    it('con envío fuera del plazo: ENVIO EXTEMPORANEO', () => {
      expect(
        calcularEstatus({
          ...base,
          fechaEnvio: '2024-03-02',
          hoy: '2024-06-01',
        }),
      ).toBe('ENVIO EXTEMPORANEO');
    });

    it('la modificación usa 30 días', () => {
      const mod = { tipoMovimientoId: 3, fechaDeclaracion: '2024-05-01' };
      expect(
        calcularEstatus({ ...mod, fechaEnvio: null, hoy: '2024-05-31' }),
      ).toBe('EN TIEMPO');
      expect(
        calcularEstatus({ ...mod, fechaEnvio: null, hoy: '2024-06-01' }),
      ).toBe('OMISO');
    });

    it('la modificación de 2021 usa 91 días', () => {
      const mod = { tipoMovimientoId: 3, fechaDeclaracion: '2021-05-01' };
      expect(
        calcularEstatus({
          ...mod,
          fechaEnvio: '2021-07-31',
          hoy: '2022-01-01',
        }),
      ).toBe('ENVIO EN TIEMPO');
      expect(
        calcularEstatus({
          ...mod,
          fechaEnvio: '2021-08-01',
          hoy: '2022-01-01',
        }),
      ).toBe('ENVIO EXTEMPORANEO');
    });
  });

  describe('estadoObligado', () => {
    it('describe obligado y no obligado con causa', () => {
      expect(estadoObligado(true, null)).toBe('OBLIGADO');
      expect(estadoObligado(false, 'POR DEFUNCIÓN')).toBe(
        'NO OBLIGADO - POR DEFUNCIÓN',
      );
      expect(estadoObligado(false, null)).toBe('NO OBLIGADO');
    });
  });

  describe('tiposPermitidos', () => {
    const todos = [1, 2, 3, 4];

    it('sin movimiento este año ofrece todos', () => {
      expect(tiposPermitidos(todos, null, '2025')).toEqual(todos);
    });

    it('tras un reingreso no ofrece ingreso', () => {
      expect(
        tiposPermitidos(
          todos,
          { tipoMovimientoId: 2, fechaDeclaracion: '2025-02-10' },
          '2025',
        ),
      ).toEqual([2, 3, 4]);
    });

    it('tras una conclusión de marzo no ofrece modificación', () => {
      expect(
        tiposPermitidos(
          todos,
          { tipoMovimientoId: 4, fechaDeclaracion: '2025-03-10' },
          '2025',
        ),
      ).toEqual([1, 2, 4]);
      expect(
        tiposPermitidos(
          todos,
          { tipoMovimientoId: 4, fechaDeclaracion: '2025-04-10' },
          '2025',
        ),
      ).toEqual(todos);
    });

    it('tras un ingreso hasta el 31 de mayo no ofrece modificación', () => {
      expect(
        tiposPermitidos(
          todos,
          { tipoMovimientoId: 1, fechaDeclaracion: '2025-05-31' },
          '2025',
        ),
      ).toEqual([1, 2, 4]);
      expect(
        tiposPermitidos(
          todos,
          { tipoMovimientoId: 1, fechaDeclaracion: '2025-06-01' },
          '2025',
        ),
      ).toEqual(todos);
    });
  });

  describe('permiteVersionLarga', () => {
    it.each([
      ['25-1', true],
      ['43-9', true],
      ['46-2', true],
      ['24-9', false],
      ['44-1', false],
      ['45-1', false],
      ['08-3', false],
    ])('nivel %s => %s', (nivel, esperado) => {
      expect(permiteVersionLarga(nivel)).toBe(esperado);
    });
  });

  it('hoyMexico usa la fecha de la zona horaria de México', () => {
    // 03:00 UTC del día 2 aún es día 1 en la Ciudad de México (UTC-6).
    expect(hoyMexico(new Date('2025-01-02T03:00:00Z'))).toBe('2025-01-01');
  });
});
