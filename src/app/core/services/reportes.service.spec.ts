import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ReportesService } from './reportes.service';

describe('ReportesService', () => {
  let servicio: ReportesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(ReportesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consulta omisos por rango de fechas', () => {
    servicio.omisos('2026-01-01', '2026-06-30').subscribe();
    const req = http.expectOne((r) => r.url === '/api/reportes/omisos');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('fecha_inicio')).toBe('2026-01-01');
    expect(req.request.params.get('fecha_fin')).toBe('2026-06-30');
    req.flush([]);
  });

  it('consulta preventivos sin filtros', () => {
    servicio.preventivos().subscribe();
    const req = http.expectOne('/api/reportes/preventivos');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('consulta el oficio previo de remisión y de preventivo', () => {
    let a: unknown;
    let b: unknown;
    servicio.oficioPrevioOmiso(5).subscribe((r) => (a = r));
    servicio.oficioPrevioPreventivo(6).subscribe((r) => (b = r));
    http.expectOne('/api/reportes/omisos/5/oficio-previo').flush({ noOficio: '0123' });
    http.expectOne('/api/reportes/preventivos/6/oficio-previo').flush({ noOficio: null });
    expect(a).toEqual({ noOficio: '0123' });
    expect(b).toEqual({ noOficio: null });
  });

  it('genera el oficio de remisión como blob', () => {
    const datos = {
      declaracionId: 5,
      folio: '0123',
      folioDadp: 'D-1',
      fechaOficio: '2026-11-20',
      fechaPadron: '2026-11-15',
      soporte: 'Soporte',
    };
    let blob: Blob | undefined;
    servicio.generarOficioOmiso(datos).subscribe((b) => (blob = b));
    const req = http.expectOne('/api/reportes/omisos/oficio');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(datos);
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['%PDF']));
    expect(blob).toBeInstanceOf(Blob);
  });

  it('genera el oficio preventivo como blob', () => {
    const datos = { declaracionId: 6, folio: '0200', fechaOficio: '2026-11-25' };
    servicio.generarOficioPreventivo(datos).subscribe();
    const req = http.expectOne('/api/reportes/preventivos/oficio');
    expect(req.request.body).toEqual(datos);
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['%PDF']));
  });

  it('envía el correo preventivo de una declaración', () => {
    let respuesta: unknown;
    servicio.enviarCorreoPreventivo(6).subscribe((r) => (respuesta = r));
    const req = http.expectOne('/api/reportes/preventivos/6/correo');
    expect(req.request.method).toBe('POST');
    req.flush({ ok: true });
    expect(respuesta).toEqual({ ok: true });
  });

  it('descarga el Excel de correos con tipo y fechas', () => {
    servicio.excelCorreos('REMISION', '2026-11-01', '2026-11-30').subscribe();
    const req = http.expectOne((r) => r.url === '/api/reportes/correos/excel');
    expect(req.request.params.get('tipo')).toBe('REMISION');
    expect(req.request.params.get('fecha_inicio')).toBe('2026-11-01');
    expect(req.request.params.get('fecha_fin')).toBe('2026-11-30');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['x']));
  });

  it('un error JSON en una respuesta blob llega con el mensaje del servidor', async () => {
    let error: { error?: { message?: string }; status?: number } | undefined;
    servicio
      .generarOficioPreventivo({ declaracionId: 1, folio: '1', fechaOficio: '2026-11-25' })
      .subscribe({ error: (e) => (error = e) });
    http
      .expectOne('/api/reportes/preventivos/oficio')
      .flush(new Blob([JSON.stringify({ message: 'Declaración no encontrada.' })]), {
        status: 404,
        statusText: 'Not Found',
      });
    await vi.waitFor(() => expect(error).toBeDefined());
    expect(error?.status).toBe(404);
    expect(error?.error?.message).toBe('Declaración no encontrada.');
  });
});
