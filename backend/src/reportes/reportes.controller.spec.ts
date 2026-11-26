import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { ReportesController, ROLES_REPORTES } from './reportes.controller';

describe('ReportesController', () => {
  it('roles: Administrador, Consulta, Estadistica y Estadistica2 (sin Registro)', () => {
    expect(ROLES_REPORTES).toEqual([
      'Administrador',
      'Consulta',
      'Estadistica',
      'Estadistica2',
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, ReportesController)).toEqual(
      ROLES_REPORTES,
    );
  });
});
