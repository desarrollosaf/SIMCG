import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ArchivosService } from './archivos.service';

describe('ArchivosService', () => {
  let dir: string;
  let servicio: ArchivosService;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'simcg-archivos-'));
    servicio = new ArchivosService({
      get: jest.fn().mockReturnValue(dir),
    } as unknown as ConfigService);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('resolverRuta rechaza path traversal y rutas absolutas', () => {
    expect(servicio.resolverRuta('../fuera.pdf')).toBeNull();
    expect(servicio.resolverRuta('a/../../fuera.pdf')).toBeNull();
    expect(servicio.resolverRuta(path.resolve(dir, '..'))).toBeNull();
    expect(servicio.resolverRuta('')).toBeNull();
    expect(servicio.resolverRuta('Actas/2025/a.pdf')).toBe(
      path.join(dir, 'Actas', '2025', 'a.pdf'),
    );
  });

  it('guarda, comprueba existencia y elimina', async () => {
    const ruta = await servicio.guardar(
      'Omisos/2025',
      'a.pdf',
      Buffer.from('x'),
    );
    expect(ruta).toBe('Omisos/2025/a.pdf');
    expect(await servicio.existe(ruta)).toBe(true);
    await servicio.eliminar(ruta);
    expect(await servicio.existe(ruta)).toBe(false);
  });

  it('guardar no escribe fuera de ARCHIVOS_DIR', async () => {
    await expect(
      servicio.guardar('../fuera', 'a.pdf', Buffer.from('x')),
    ).rejects.toThrow();
  });

  it('descargar arma la respuesta con content-type y disposition', async () => {
    const ruta = await servicio.guardar(
      'Docs',
      'Oficio ñ.pdf',
      Buffer.from('%PDF'),
    );
    const archivo = await servicio.descargar(ruta, 'inline');
    const cabeceras = archivo.getHeaders();
    expect(cabeceras.type).toBe('application/pdf');
    expect(cabeceras.disposition).toContain('inline; filename="Oficio _.pdf"');
    expect(cabeceras.disposition).toContain("UTF-8''Oficio%20%C3%B1.pdf");
    archivo.getStream().destroy();
  });

  it('descargar lanza NotFound si no existe o sale del directorio', async () => {
    await expect(servicio.descargar('no.pdf')).rejects.toThrow(
      NotFoundException,
    );
    await expect(servicio.descargar('../x.pdf')).rejects.toThrow(
      NotFoundException,
    );
    await expect(servicio.descargar(null)).rejects.toThrow(NotFoundException);
  });
});
