import { TestBed } from '@angular/core/testing';
import { Paginador, paginasVisibles } from './paginador';

describe('paginasVisibles', () => {
  it('muestra todas si son pocas', () => {
    expect(paginasVisibles(1, 1)).toEqual([1]);
    expect(paginasVisibles(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('compacta con elipsis en ambos lados', () => {
    expect(paginasVisibles(5, 20)).toEqual([1, null, 4, 5, 6, null, 20]);
  });

  it('al inicio y al final solo hay una elipsis', () => {
    expect(paginasVisibles(1, 20)).toEqual([1, 2, 3, 4, null, 20]);
    expect(paginasVisibles(3, 20)).toEqual([1, 2, 3, 4, null, 20]);
    expect(paginasVisibles(20, 20)).toEqual([1, null, 17, 18, 19, 20]);
    expect(paginasVisibles(18, 20)).toEqual([1, null, 17, 18, 19, 20]);
  });
});

describe('Paginador', () => {
  const crear = (valores: Record<string, unknown>) => {
    const fixture = TestBed.createComponent(Paginador);
    for (const [k, v] of Object.entries(valores)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const boton = (etiqueta: string) =>
      el.querySelector<HTMLButtonElement>(`button[aria-label="${etiqueta}"]`)!;
    return { fixture, el, boton, c: fixture.componentInstance };
  };

  it('muestra el rango y el total con separador de miles', () => {
    const { el } = crear({ pagina: 1, total: 3456, limite: 10 });
    expect(el.querySelector('.paginador__info')?.textContent).toContain('Mostrando 11–20 de 3,456');
  });

  it('resalta la página actual y emite al elegir otra', () => {
    const { el, boton, c } = crear({ pagina: 4, total: 200, limite: 10 });
    const emitida = vi.fn();
    c.paginaCambiada.subscribe(emitida);
    expect(el.querySelector('.paginador__numero--actual')?.textContent?.trim()).toBe('5');
    boton('Página 6').click();
    expect(emitida).toHaveBeenCalledWith(5);
    boton('Última página').click();
    expect(emitida).toHaveBeenCalledWith(19);
    boton('Primera página').click();
    expect(emitida).toHaveBeenCalledWith(0);
  });

  it('deshabilita anterior/primera en la primera página y siguiente/última en la última', () => {
    const primera = crear({ pagina: 0, total: 30, limite: 10 });
    expect(primera.boton('Página anterior').disabled).toBe(true);
    expect(primera.boton('Primera página').disabled).toBe(true);
    expect(primera.boton('Página siguiente').disabled).toBe(false);

    const ultima = crear({ pagina: 2, total: 30, limite: 10 });
    expect(ultima.boton('Página siguiente').disabled).toBe(true);
    expect(ultima.boton('Última página').disabled).toBe(true);
  });

  it('emite el nuevo tamaño de página y no navega si está deshabilitado', () => {
    const { el, c, boton } = crear({ pagina: 1, total: 100, limite: 10, deshabilitado: true });
    const limite = vi.fn();
    const pagina = vi.fn();
    c.limiteCambiado.subscribe(limite);
    c.paginaCambiada.subscribe(pagina);

    const select = el.querySelector('select')!;
    select.value = '20';
    select.dispatchEvent(new Event('change'));
    expect(limite).toHaveBeenCalledWith(20);

    boton('Página siguiente').click();
    c.ir(3);
    expect(pagina).not.toHaveBeenCalled();
  });
});
