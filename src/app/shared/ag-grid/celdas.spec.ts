import { TestBed } from '@angular/core/testing';
import { AvatarIniciales, iniciales } from './avatar-iniciales';
import { CeldaDosNiveles, CeldaDosNivelesParams } from './celda-dos-niveles';
import { CeldaEstatus, CeldaEstatusParams } from './celda-estatus';
import { ChipEstatus } from './chip-estatus';

interface Fila {
  nombre: string;
  curp: string | null;
  baja: boolean;
}

const fila: Fila = { nombre: 'Ana López Díaz', curp: 'LODA010101', baja: false };

describe('iniciales', () => {
  it('toma máximo dos letras en mayúscula', () => {
    expect(iniciales('ana lópez díaz')).toBe('AL');
    expect(iniciales('  Luis ')).toBe('L');
    expect(iniciales(null)).toBe('');
  });
});

describe('AvatarIniciales', () => {
  it('pinta las iniciales', () => {
    const f = TestBed.createComponent(AvatarIniciales);
    f.componentRef.setInput('nombre', 'Ana López');
    f.detectChanges();
    expect(f.nativeElement.textContent.trim()).toBe('AL');
  });
});

describe('ChipEstatus', () => {
  it('expone el tono para el color', () => {
    const f = TestBed.createComponent(ChipEstatus);
    f.componentRef.setInput('texto', 'Baja');
    f.componentRef.setInput('tono', 'error');
    f.detectChanges();
    expect(f.nativeElement.textContent.trim()).toBe('Baja');
    expect(f.nativeElement.getAttribute('data-tono')).toBe('error');
  });
});

describe('CeldaDosNiveles', () => {
  const crear = (
    extra: Partial<CeldaDosNivelesParams<Fila>> = {},
    datos: Fila | undefined = fila,
  ) => {
    const f = TestBed.createComponent(CeldaDosNiveles<Fila>);
    f.componentInstance.agInit({
      data: datos,
      principal: (x: Fila) => x.nombre,
      secundario: (x: Fila) => x.curp,
      ...extra,
    } as unknown as CeldaDosNivelesParams<Fila>);
    f.detectChanges();
    return f;
  };

  it('muestra principal y secundario', () => {
    const el: HTMLElement = crear().nativeElement;
    expect(el.querySelector('.principal')?.textContent).toBe('Ana López Díaz');
    expect(el.querySelector('.secundario')?.textContent).toBe('LODA010101');
    expect(el.querySelector('app-avatar-iniciales')).toBeNull();
  });

  it('con avatar y mono dibuja las iniciales y la clase monoespaciada', () => {
    const el: HTMLElement = crear({ avatar: true, monoSecundario: true }).nativeElement;
    expect(el.querySelector('app-avatar-iniciales')?.textContent?.trim()).toBe('AL');
    expect(el.querySelector('.secundario')?.classList).toContain('mono');
  });

  it('omite el secundario vacío y tolera filas sin datos', () => {
    expect(crear({ secundario: () => null }).nativeElement.querySelector('.secundario')).toBeNull();
    expect(
      crear({}, null as unknown as Fila).nativeElement.querySelector('.principal')?.textContent,
    ).toBe('');
  });

  it('refresh actualiza el contenido', () => {
    const f = crear();
    f.componentInstance.refresh({
      data: { ...fila, nombre: 'Luis' },
      principal: (x: Fila) => x.nombre,
    } as unknown as CeldaDosNivelesParams<Fila>);
    f.detectChanges();
    expect(f.nativeElement.querySelector('.principal').textContent).toBe('Luis');
    expect(f.nativeElement.querySelector('.secundario')).toBeNull();
  });
});

describe('CeldaEstatus', () => {
  it('dibuja el chip que devuelve la función de estatus', () => {
    const f = TestBed.createComponent(CeldaEstatus<Fila>);
    f.componentInstance.agInit({
      data: fila,
      estatus: (x: Fila) =>
        x.baja ? { texto: 'Baja', tono: 'error' } : { texto: 'Obligado', tono: 'ok' },
    } as unknown as CeldaEstatusParams<Fila>);
    f.detectChanges();
    const chip = f.nativeElement.querySelector('app-chip-estatus');
    expect(chip.textContent.trim()).toBe('Obligado');
    expect(chip.getAttribute('data-tono')).toBe('ok');
  });

  it('sin fila no dibuja chip', () => {
    const f = TestBed.createComponent(CeldaEstatus<Fila>);
    f.componentInstance.agInit({ estatus: () => null } as unknown as CeldaEstatusParams<Fila>);
    f.detectChanges();
    expect(f.nativeElement.querySelector('app-chip-estatus')).toBeNull();
  });
});
