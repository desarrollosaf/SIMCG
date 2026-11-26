import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { DeclaracionPdfController } from './declaracion-pdf.controller';
import type { DeclaracionPdfService } from './declaracion-pdf.service';

describe('DeclaracionPdfController', () => {
  const servicio = { generar: jest.fn() };
  const controlador = new DeclaracionPdfController(
    servicio as unknown as DeclaracionPdfService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    servicio.generar.mockResolvedValue(Buffer.from('%PDF-1.4'));
  });

  it('solo abren el PDF los roles del middleware roleConsulta del sistema anterior', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      DeclaracionPdfController,
    ) as string[];
    expect([...roles].sort()).toEqual([
      'Administrador',
      'Consulta',
      'Estadistica',
      'Estadistica2',
    ]);
    expect(roles).not.toContain('Registro');
  });

  it('pdf devuelve la declaración pública en línea con el nombre declaracion.pdf', async () => {
    const respuesta = await controlador.publica(3, 8);
    expect(servicio.generar).toHaveBeenCalledWith(3, 8, false);
    expect(respuesta.getHeaders().type).toBe('application/pdf');
    expect(respuesta.getHeaders().disposition).toContain('inline');
    expect(respuesta.getHeaders().disposition).toContain('declaracion.pdf');
  });

  it('pdf-privada devuelve la declaración privada', async () => {
    await controlador.privada(3, 8);
    expect(servicio.generar).toHaveBeenCalledWith(3, 8, true);
  });
});
