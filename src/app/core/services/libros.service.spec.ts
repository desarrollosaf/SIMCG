import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LibrosService } from './libros.service';

describe('LibrosService', () => {
  let servicio: LibrosService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(LibrosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista los años', () => {
    servicio.anios().subscribe();
    http.expectOne('/api/libros/anios').flush([2025]);
  });

  it('pide el resumen del año', () => {
    servicio.resumen(2025).subscribe();
    const req = http.expectOne((r) => r.url === '/api/libros/resumen');
    expect(req.request.params.get('anio')).toBe('2025');
    req.flush({});
  });

  it('pagina las declaraciones en el servidor', () => {
    servicio
      .declaraciones({ anio: 2025, tipo: 'modificacion', buscar: 'ana', inicio: 20, limite: 10 })
      .subscribe();
    const req = http.expectOne((r) => r.url === '/api/libros/declaraciones');
    expect(req.request.params.get('anio')).toBe('2025');
    expect(req.request.params.get('tipo')).toBe('modificacion');
    expect(req.request.params.get('buscar')).toBe('ana');
    expect(req.request.params.get('inicio')).toBe('20');
    expect(req.request.params.get('limite')).toBe('10');
    req.flush({ total: 0, filas: [] });
  });

  it('no manda buscar vacío', () => {
    servicio
      .declaraciones({ anio: 2025, tipo: 'inicial', buscar: '', inicio: 0, limite: 10 })
      .subscribe();
    const req = http.expectOne((r) => r.url === '/api/libros/declaraciones');
    expect(req.request.params.has('buscar')).toBe(false);
    req.flush({ total: 0, filas: [] });
  });

  it('lista las actas del año', () => {
    servicio.actas(2024).subscribe();
    const req = http.expectOne((r) => r.url === '/api/libros/actas');
    expect(req.request.params.get('anio')).toBe('2024');
    req.flush([]);
  });

  it('guarda el acta con archivo, anio y tipo', () => {
    const archivo = new File(['a'], 'acta.pdf', { type: 'application/pdf' });
    servicio.guardarActa(archivo, 2025, 'conclusion').subscribe();
    const req = http.expectOne('/api/libros/actas');
    expect(req.request.method).toBe('POST');
    const datos = req.request.body as FormData;
    expect(datos.get('archivo')).toBeInstanceOf(File);
    expect(datos.get('anio')).toBe('2025');
    expect(datos.get('tipo')).toBe('conclusion');
    req.flush({});
  });

  it('descarga acta y soporte como blob', () => {
    servicio.descargarArchivo(7, 'acta').subscribe();
    const a = http.expectOne('/api/libros/actas/7/acta');
    expect(a.request.responseType).toBe('blob');
    a.flush(new Blob(['x']));

    servicio.descargarArchivo(7, 'soporte').subscribe();
    const s = http.expectOne('/api/libros/actas/7/soporte');
    expect(s.request.responseType).toBe('blob');
    s.flush(new Blob(['x']));
  });
});
