import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CargasService } from './cargas.service';

describe('CargasService', () => {
  let servicio: CargasService;
  let http: HttpTestingController;
  const archivo = new File(['a'], 'datos.csv', { type: 'text/csv' });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(CargasService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide el layout de servidores como blob', () => {
    servicio.descargarLayoutServidores().subscribe();
    const req = http.expectOne('/api/cargas/servidores/layout');
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['x']));
  });

  it('previsualiza servidores con el campo archivo', () => {
    servicio.previsualizarServidores(archivo).subscribe();
    const req = http.expectOne('/api/cargas/servidores/previsualizar');
    expect(req.request.method).toBe('POST');
    expect((req.request.body as FormData).get('archivo')).toBeInstanceOf(File);
    req.flush({ total: 0, validas: 0, conErrores: 0, filas: [] });
  });

  it('confirma servidores con el archivo', () => {
    servicio.confirmarServidores(archivo).subscribe();
    const req = http.expectOne('/api/cargas/servidores/confirmar');
    expect((req.request.body as FormData).get('archivo')).toBeInstanceOf(File);
    req.flush({ insertados: 1, omitidos: 0 });
  });

  it('pide el layout de no obligados como blob', () => {
    servicio.descargarLayoutNoObligados().subscribe();
    const req = http.expectOne('/api/cargas/no-obligados/layout');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['x']));
  });

  it('previsualiza y confirma no obligados con el campo archivo', () => {
    servicio.previsualizarNoObligados(archivo).subscribe();
    const prev = http.expectOne('/api/cargas/no-obligados/previsualizar');
    expect((prev.request.body as FormData).get('archivo')).toBeInstanceOf(File);
    prev.flush({ total: 0, aplicables: 0, omitidos: 0, filas: [] });

    servicio.confirmarNoObligados(archivo).subscribe();
    const conf = http.expectOne('/api/cargas/no-obligados/confirmar');
    expect((conf.request.body as FormData).get('archivo')).toBeInstanceOf(File);
    conf.flush({ actualizados: 0, renglonesAplicados: 0, omitidos: 0 });
  });
});
