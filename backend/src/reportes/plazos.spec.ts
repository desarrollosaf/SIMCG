import {
  estatusGeneral,
  estatusOmisos,
  estatusPreventivo,
  fechaLimite,
} from './plazos';

const base = {
  tipoMovimientoId: 1,
  fechaDeclaracion: '2026-01-01',
  fechaEnvio: null,
  hoy: '2026-12-31',
};

describe('plazos', () => {
  describe('fechaLimite', () => {
    it('ingreso, reingreso y conclusión: 60 días', () => {
      for (const tipo of [1, 2, 4]) {
        expect(fechaLimite(tipo, '2026-01-01')).toBe('2026-03-02');
      }
    });

    it('modificación: 30 días, y 91 días si la declaración es de 2021', () => {
      expect(fechaLimite(3, '2026-05-01')).toBe('2026-05-31');
      expect(fechaLimite(3, '2025-05-01')).toBe('2025-05-31');
      expect(fechaLimite(3, '2021-05-01')).toBe('2021-07-31');
      expect(fechaLimite(3, '2022-05-01')).toBe('2022-05-31');
    });

    it('el plazo de 91 días solo aplica a modificaciones', () => {
      expect(fechaLimite(1, '2021-01-01')).toBe('2021-03-02');
    });

    it('cruza fin de mes y de año', () => {
      expect(fechaLimite(1, '2026-12-01')).toBe('2027-01-30');
      expect(fechaLimite(3, '2026-12-15')).toBe('2027-01-14');
    });
  });

  describe('estatusOmisos', () => {
    it('sin envío es OMISO solo si el límite ya pasó (estricto)', () => {
      // límite = 2026-03-02
      expect(estatusOmisos({ ...base, hoy: '2026-03-03' })).toBe('OMISO');
      expect(estatusOmisos({ ...base, hoy: '2026-03-02' })).toBeNull();
      expect(estatusOmisos({ ...base, hoy: '2026-03-01' })).toBeNull();
    });

    it('modificación sin envío: 30 días (91 en 2021)', () => {
      const mod = {
        ...base,
        tipoMovimientoId: 3,
        fechaDeclaracion: '2026-05-01',
      };
      expect(estatusOmisos({ ...mod, hoy: '2026-05-31' })).toBeNull();
      expect(estatusOmisos({ ...mod, hoy: '2026-06-01' })).toBe('OMISO');
      const m2021 = { ...mod, fechaDeclaracion: '2021-05-01' };
      expect(estatusOmisos({ ...m2021, hoy: '2021-07-31' })).toBeNull();
      expect(estatusOmisos({ ...m2021, hoy: '2021-08-01' })).toBe('OMISO');
    });

    it('con envío es ENVIO EXTEMPORANEO solo si el envío es posterior al límite', () => {
      expect(estatusOmisos({ ...base, fechaEnvio: '2026-03-03' })).toBe(
        'ENVIO EXTEMPORANEO',
      );
      expect(estatusOmisos({ ...base, fechaEnvio: '2026-03-02' })).toBeNull();
      expect(estatusOmisos({ ...base, fechaEnvio: '2026-02-01' })).toBeNull();
    });

    it('modificación con envío: compara contra el límite de 30 días', () => {
      const mod = {
        ...base,
        tipoMovimientoId: 3,
        fechaDeclaracion: '2026-05-01',
      };
      expect(estatusOmisos({ ...mod, fechaEnvio: '2026-05-31' })).toBeNull();
      expect(estatusOmisos({ ...mod, fechaEnvio: '2026-06-01' })).toBe(
        'ENVIO EXTEMPORANEO',
      );
      // un envío a los 45 días es extemporáneo en 2026 pero a tiempo en 2021
      expect(estatusOmisos({ ...mod, fechaEnvio: '2026-06-15' })).toBe(
        'ENVIO EXTEMPORANEO',
      );
      expect(
        estatusOmisos({
          ...mod,
          fechaDeclaracion: '2021-05-01',
          fechaEnvio: '2021-06-15',
        }),
      ).toBeNull();
    });
  });

  describe('estatusPreventivo', () => {
    it('EN TIEMPO solo sin envío y con límite posterior a hoy (estricto)', () => {
      expect(estatusPreventivo({ ...base, hoy: '2026-03-01' })).toBe(
        'EN TIEMPO',
      );
      // el día exacto del límite el viejo no lo mostraba (ni omiso ni en tiempo)
      expect(estatusPreventivo({ ...base, hoy: '2026-03-02' })).toBeNull();
      expect(estatusPreventivo({ ...base, hoy: '2026-03-03' })).toBeNull();
    });

    it('con envío nunca es preventivo', () => {
      expect(
        estatusPreventivo({
          ...base,
          hoy: '2026-01-02',
          fechaEnvio: '2026-01-02',
        }),
      ).toBeNull();
    });

    it('modificación: 30 días (91 en 2021)', () => {
      const mod = {
        ...base,
        tipoMovimientoId: 3,
        fechaDeclaracion: '2026-05-01',
      };
      expect(estatusPreventivo({ ...mod, hoy: '2026-05-30' })).toBe(
        'EN TIEMPO',
      );
      expect(estatusPreventivo({ ...mod, hoy: '2026-05-31' })).toBeNull();
      const m2021 = { ...mod, fechaDeclaracion: '2021-05-01' };
      expect(estatusPreventivo({ ...m2021, hoy: '2021-07-30' })).toBe(
        'EN TIEMPO',
      );
      expect(estatusPreventivo({ ...m2021, hoy: '2021-07-31' })).toBeNull();
    });

    it('omisos y preventivos nunca coinciden para la misma declaración', () => {
      for (const hoy of ['2026-03-01', '2026-03-02', '2026-03-03']) {
        const e = { ...base, hoy };
        expect(!!estatusOmisos(e) && !!estatusPreventivo(e)).toBe(false);
      }
    });
  });

  describe('estatusGeneral (reporte general)', () => {
    it('OMISO / EN TIEMPO sin envío', () => {
      expect(estatusGeneral({ ...base, hoy: '2026-03-03' })).toBe('OMISO');
      expect(estatusGeneral({ ...base, hoy: '2026-03-01' })).toBe('EN TIEMPO');
    });

    it('en el día exacto del límite el general lo da EN TIEMPO', () => {
      expect(estatusGeneral({ ...base, hoy: '2026-03-02' })).toBe('EN TIEMPO');
    });

    it('ENVIO EXTEMPORANEO / ENVIO EN TIEMPO con envío (sin espacio final)', () => {
      expect(estatusGeneral({ ...base, fechaEnvio: '2026-03-03' })).toBe(
        'ENVIO EXTEMPORANEO',
      );
      expect(estatusGeneral({ ...base, fechaEnvio: '2026-03-02' })).toBe(
        'ENVIO EN TIEMPO',
      );
    });

    it('modificación 2021 con 91 días', () => {
      const m = {
        ...base,
        tipoMovimientoId: 3,
        fechaDeclaracion: '2021-05-01',
        fechaEnvio: '2021-07-31',
      };
      expect(estatusGeneral(m)).toBe('ENVIO EN TIEMPO');
      expect(estatusGeneral({ ...m, fechaEnvio: '2021-08-01' })).toBe(
        'ENVIO EXTEMPORANEO',
      );
    });
  });
});
