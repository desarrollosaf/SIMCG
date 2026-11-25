import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ServidoresService } from './servidores.service';

describe('ServidoresService', () => {
  let servicio: ServidoresService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(ServidoresService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista con paginación, orden y búsqueda en el servidor', () => {
    servicio
      .listar({
        inicio: 20,
        limite: 10,
        buscar: 'martin sanchez',
        ordenar: 'curp',
        direccion: 'desc',
      })
      .subscribe();

    const req = http.expectOne((r) => r.url === '/api/servidores');
    expect(req.request.params.get('inicio')).toBe('20');
    expect(req.request.params.get('limite')).toBe('10');
    expect(req.request.params.get('buscar')).toBe('martin sanchez');
    expect(req.request.params.get('ordenar')).toBe('curp');
    expect(req.request.params.get('direccion')).toBe('desc');
    req.flush({ total: 0, filas: [] });
  });

  it('no manda buscar si está vacío', () => {
    servicio
      .listar({ inicio: 0, limite: 10, buscar: '', ordenar: 'nombre', direccion: 'asc' })
      .subscribe();

    const req = http.expectOne((r) => r.url === '/api/servidores');
    expect(req.request.params.has('buscar')).toBe(false);
    req.flush({ total: 0, filas: [] });
  });

  it('da de baja mandando el motivo en el cuerpo del DELETE', () => {
    servicio.baja(5, 'RENUNCIA').subscribe();

    const req = http.expectOne('/api/servidores/5');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toEqual({ motivo: 'RENUNCIA' });
    req.flush({ mensaje: 'ok' });
  });

  it('cambia obligado con su motivo', () => {
    servicio.cambiarObligado(9, false, 2).subscribe();

    const req = http.expectOne('/api/movimientos/9/obligado');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ obligado: false, motivoNoObligadoId: 2 });
    req.flush({ mensaje: 'ok' });
  });

  it('crea un movimiento para el servidor', () => {
    servicio.crearMovimiento(5, 3).subscribe();

    const req = http.expectOne('/api/servidores/5/movimientos');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ tipoMovimientoId: 3 });
    req.flush({ id: 1 });
  });
});
