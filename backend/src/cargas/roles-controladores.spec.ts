import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { LibrosController } from '../libros/libros.controller';
import { CargasController } from './cargas.controller';

// Roles efectivos de un handler: el del método manda sobre el de la clase.
const roles = (
  controlador: { prototype: object },
  metodo: string,
): string[] => {
  const handler = (controlador.prototype as Record<string, () => void>)[metodo];
  return (
    (Reflect.getMetadata(ROLES_KEY, handler) as string[] | undefined) ??
    (Reflect.getMetadata(ROLES_KEY, controlador) as string[] | undefined) ??
    []
  );
};

describe('roles de los controladores de cargas y libros', () => {
  it('alta masiva de servidores: Administrador y Registro', () => {
    for (const m of [
      'layoutServidores',
      'previsualizarServidores',
      'confirmarServidores',
    ]) {
      expect(roles(CargasController, m)).toEqual(['Administrador', 'Registro']);
    }
  });

  it('no obligados: solo Administrador', () => {
    for (const m of [
      'layoutNoObligados',
      'previsualizarNoObligados',
      'confirmarNoObligados',
    ]) {
      expect(roles(CargasController, m)).toEqual(['Administrador']);
    }
  });

  it('libros: solo Administrador en todas las rutas', () => {
    for (const m of [
      'anios',
      'resumen',
      'declaraciones',
      'actas',
      'subirActa',
      'acta',
      'soporte',
    ]) {
      expect(roles(LibrosController, m)).toEqual(['Administrador']);
    }
  });
});
