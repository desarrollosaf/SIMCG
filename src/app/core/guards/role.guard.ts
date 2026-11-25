import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Seccion, puedeVer } from '../access/acceso-por-rol';
import { AuthService } from '../services/auth.service';

export const roleGuard =
  (seccion: Seccion): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (puedeVer(auth.currentUser()?.roles, seccion)) {
      return true;
    }

    return router.parseUrl('/home');
  };
