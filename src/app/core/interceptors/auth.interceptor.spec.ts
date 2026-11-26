import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { MENSAJE_SIN_CONEXION, authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  const auth = { token: 'abc', logout: vi.fn() };
  const router = { navigate: vi.fn() };
  const url = `${environment.apiUrl}/servidores`;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
  });

  const fallar = (status: number, solicitudes = 1) => {
    const http = TestBed.inject(HttpClient);
    const controlador = TestBed.inject(HttpTestingController);
    for (let i = 0; i < solicitudes; i++) http.get(url).subscribe({ error: () => undefined });
    for (const r of controlador.match(url)) {
      r.error(new ProgressEvent('error'), { status, statusText: 'x' });
    }
  };

  it('muestra un aviso global solo para errores de red (status 0) y sin duplicarlo', () => {
    fallar(0, 3);
    const toasts = TestBed.inject(ToastService).toasts();
    expect(toasts.length).toBe(1);
    expect(toasts[0].mensaje).toBe(MENSAJE_SIN_CONEXION);
    expect(toasts[0].tipo).toBe('error');
  });

  it('no avisa en errores 4xx/5xx (lo hace cada componente)', () => {
    fallar(500);
    expect(TestBed.inject(ToastService).toasts().length).toBe(0);
  });

  it('en 401 cierra sesión y manda al login', () => {
    fallar(401);
    expect(auth.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { motivo: 'sesion' } });
  });
});
