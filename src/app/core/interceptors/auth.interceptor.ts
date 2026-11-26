import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { esErrorDeRed } from '../../shared/utils/descarga';
import { environment } from '../../../environments/environment';

export const MENSAJE_SIN_CONEXION =
  'Sin conexión con el servidor. Revisa tu red e intenta de nuevo.';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  const authService = inject(AuthService);
  const router = inject(Router);
  const toastService = inject(ToastService);
  const token = authService.token;

  const solicitud = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(solicitud).pipe(
    catchError((error: unknown) => {
      const esLogin = req.url === `${environment.apiUrl}/auth/login`;

      if (error instanceof HttpErrorResponse && error.status === 401 && !esLogin) {
        authService.logout();
        void router.navigate(['/login'], { queryParams: { motivo: 'sesion' } });
      }

      // Aviso global único para fallas de red; los componentes omiten su toast con status 0.
      if (
        esErrorDeRed(error) &&
        !toastService.toasts().some((t) => t.mensaje === MENSAJE_SIN_CONEXION)
      ) {
        toastService.error(MENSAJE_SIN_CONEXION);
      }

      return throwError(() => error);
    }),
  );
};
