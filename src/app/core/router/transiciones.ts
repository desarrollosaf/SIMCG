import { ActivatedRouteSnapshot, ViewTransitionInfo } from '@angular/router';

/** Segmentos de la URL activa (sin query params), recorriendo el hijo primario de la ruta. */
export function segmentosDe(snapshot: ActivatedRouteSnapshot): string[] {
  const segmentos: string[] = [];
  let actual: ActivatedRouteSnapshot | null = snapshot.root;
  while (actual) {
    segmentos.push(...actual.url.map((s) => s.path));
    actual = actual.firstChild;
  }
  return segmentos;
}

/**
 * La transición de página solo aplica cuando cambia el primer segmento de la URL (de módulo).
 * Abrir o cerrar un modal hijo del mismo módulo, o cambiar solo query params, no la anima.
 */
export function debeOmitirTransicion(desde: string[], hacia: string[]): boolean {
  return (desde[0] ?? '') === (hacia[0] ?? '');
}

/** Para `withViewTransitions({ onViewTransitionCreated })`. */
export function alCrearTransicion(info: ViewTransitionInfo): void {
  if (debeOmitirTransicion(segmentosDe(info.from), segmentosDe(info.to))) {
    info.transition.skipTransition();
  }
}
