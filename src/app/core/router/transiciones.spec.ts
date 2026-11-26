import { ActivatedRouteSnapshot, UrlSegment } from '@angular/router';
import { alCrearTransicion, debeOmitirTransicion, segmentosDe } from './transiciones';

const ruta = (...segmentos: string[][]): ActivatedRouteSnapshot => {
  // Una cadena de rutas, cada una con sus segmentos de URL.
  const raiz: any = { url: [], firstChild: null };
  raiz.root = raiz;
  let actual = raiz;
  for (const s of segmentos) {
    const hijo: any = { url: s.map((p) => new UrlSegment(p, {})), firstChild: null, root: raiz };
    actual.firstChild = hijo;
    actual = hijo;
  }
  return actual as ActivatedRouteSnapshot;
};

describe('transiciones de página', () => {
  it('omite la transición si solo cambia un modal hijo del mismo módulo', () => {
    expect(debeOmitirTransicion(['servidores'], ['servidores', '12', 'movimientos'])).toBe(true);
    expect(debeOmitirTransicion(['servidores', '12', 'movimientos'], ['servidores'])).toBe(true);
    expect(debeOmitirTransicion(['servidores'], ['servidores'])).toBe(true);
  });

  it('anima cuando cambia el primer segmento', () => {
    expect(debeOmitirTransicion(['home'], ['servidores'])).toBe(false);
    expect(debeOmitirTransicion([], ['home'])).toBe(false);
  });

  it('segmentosDe recorre la cadena de rutas activa', () => {
    const hoja = ruta(['servidores'], [], ['12', 'movimientos']);
    expect(segmentosDe(hoja)).toEqual(['servidores', '12', 'movimientos']);
  });

  it('alCrearTransicion llama skipTransition solo cuando corresponde', () => {
    const transition = { skipTransition: vi.fn() };
    alCrearTransicion({
      transition,
      from: ruta(['servidores']),
      to: ruta(['servidores'], ['nuevo']),
    } as any);
    expect(transition.skipTransition).toHaveBeenCalledTimes(1);

    alCrearTransicion({ transition, from: ruta(['home']), to: ruta(['servidores']) } as any);
    expect(transition.skipTransition).toHaveBeenCalledTimes(1);
  });
});
