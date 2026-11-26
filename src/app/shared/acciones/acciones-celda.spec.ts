import { TestBed } from '@angular/core/testing';
import { AccionFila, AccionesCelda, AccionesCeldaParams } from './acciones-celda';

interface Fila {
  id: number;
  activo: boolean;
}

describe('AccionesCelda', () => {
  const editar = vi.fn();
  const baja = vi.fn();

  const acciones: AccionFila<Fila>[] = [
    { etiqueta: 'Editar', icono: 'editar', ejecutar: editar },
    { etiqueta: 'Baja', icono: 'basura', peligro: true, visible: (f) => f.activo, ejecutar: baja },
  ];

  const crear = (fila: Fila, lista = acciones) => {
    const fixture = TestBed.createComponent(AccionesCelda<Fila>);
    fixture.componentInstance.agInit({
      data: fila,
      acciones: lista,
    } as unknown as AccionesCeldaParams<Fila>);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => vi.clearAllMocks());

  it('muestra un único botón ⋮ y abre el menú con las acciones visibles', () => {
    const fixture = crear({ id: 2, activo: true });
    const botones = fixture.nativeElement.querySelectorAll('button');
    expect(botones.length).toBe(1);
    expect(botones[0].getAttribute('aria-label')).toBe('Más acciones');

    botones[0].click();
    fixture.detectChanges();
    const items = Array.from(document.querySelectorAll<HTMLElement>('.menu-acciones__item'));
    expect(items.map((i) => i.textContent?.trim())).toEqual(['Editar', 'Baja']);
    items[1].click();
    expect(baja).toHaveBeenCalledWith({ id: 2, activo: true });
  });

  it('oculta las acciones cuya visibilidad es false para la fila', () => {
    const fixture = crear({ id: 3, activo: false });
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();

    const items = Array.from(document.querySelectorAll('.menu-acciones__item'));
    expect(items.map((i) => i.textContent?.trim())).toEqual(['Editar']);
  });

  it('sin acciones visibles no dibuja el botón', () => {
    const fixture = crear({ id: 4, activo: false }, [acciones[1]]);
    expect(fixture.nativeElement.querySelectorAll('button').length).toBe(0);
  });

  it('refresh reevalúa la visibilidad con la nueva fila', () => {
    const fixture = crear({ id: 5, activo: false }, [acciones[1]]);
    expect(fixture.nativeElement.querySelectorAll('button').length).toBe(0);

    fixture.componentInstance.refresh({
      data: { id: 5, activo: true },
      acciones: [acciones[1]],
    } as unknown as AccionesCeldaParams<Fila>);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('button').length).toBe(1);
  });
});
