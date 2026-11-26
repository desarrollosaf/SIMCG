import { CanDeactivateFn, Router } from '@angular/router';

/** Cierra el modal hijo y vuelve a la lista conservando su búsqueda, página y orden. */
export function cerrarModalServidores(router: Router): Promise<boolean> {
  return router.navigate(['/servidores'], { queryParamsHandling: 'preserve' });
}

/** Abre un modal hijo (alta, edición o movimientos) sobre la lista conservando su estado. */
export function abrirModalServidores(
  router: Router,
  ...ruta: (string | number)[]
): Promise<boolean> {
  return router.navigate(['/servidores', ...ruta], { queryParamsHandling: 'preserve' });
}

/** Componentes que pueden avisar que tienen cambios sin guardar. */
export interface ConCambiosPendientes {
  puedeSalir(): boolean | Promise<boolean>;
}

export const sinCambiosPendientesGuard: CanDeactivateFn<ConCambiosPendientes> = (componente) =>
  componente.puedeSalir();
