import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { aplanarMenu, menuParaRoles } from '../../core/access/menu';
import { AuthService } from '../../core/services/auth.service';
import { ServidoresPagina, ServidoresService } from '../../core/services/servidores.service';
import { BuscadorGlobal, filtrarModulos, resaltar } from './buscador-global';

describe('filtrarModulos y resaltar', () => {
  const destinos = (roles: string[]) => aplanarMenu(menuParaRoles(roles));

  it('filtra por rol: Consulta no ve administración', () => {
    expect(filtrarModulos(destinos(['Consulta']), 'usuarios')).toEqual([]);
    expect(filtrarModulos(destinos(['Administrador']), 'usuarios').length).toBeGreaterThan(0);
  });

  it('coincide desde 1 carácter, sin acentos ni mayúsculas', () => {
    const r = filtrarModulos(destinos(['Administrador']), 'DETECCION');
    expect(r.length).toBeGreaterThan(0);
    expect(filtrarModulos(destinos(['Administrador']), 'i').length).toBeGreaterThan(0);
  });

  it('resalta la coincidencia respetando acentos originales', () => {
    expect(resaltar('Detección', 'ecci')).toEqual([
      { texto: 'Det', resaltado: false },
      { texto: 'ecci', resaltado: true },
      { texto: 'ón', resaltado: false },
    ]);
    expect(resaltar('abc', '')).toEqual([{ texto: 'abc', resaltado: false }]);
  });
});

describe('BuscadorGlobal', () => {
  let fixture: ComponentFixture<BuscadorGlobal>;
  let listar: ReturnType<typeof vi.fn>;
  let navegar: ReturnType<typeof vi.spyOn>;
  let el: HTMLElement;
  let input: HTMLInputElement;

  const pagina = (nombre: string): ServidoresPagina =>
    ({ total: 1, filas: [{ id: 7, nombre, curp: 'ABCD010101HDFXXX01' }] }) as ServidoresPagina;

  function escribir(valor: string): void {
    input.focus();
    input.dispatchEvent(new Event('focus'));
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function tecla(key: string): void {
    input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    listar = vi.fn().mockReturnValue(of(pagina('Juan Pérez')));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ServidoresService, useValue: { listar } },
        { provide: AuthService, useValue: { currentUser: () => ({ roles: ['Administrador'] }) } },
      ],
    });
    navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(BuscadorGlobal);
    fixture.detectChanges();
    el = fixture.nativeElement;
    // El campo solo existe tras pulsar la lupa.
    el.querySelector<HTMLButtonElement>('button.ico')!.click();
    fixture.detectChanges();
    input = el.querySelector('input')!;
  });

  afterEach(() => vi.useRealTimers());

  it('es un combobox y muestra módulos al instante, sin consultar servidores', () => {
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    escribir('rep');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelectorAll('[role="option"]').length).toBeGreaterThan(0);
    expect(el.querySelector('mark')).toBeTruthy();
    expect(listar).not.toHaveBeenCalled();
  });

  it('consulta servidores con debounce y mínimo de 3 caracteres', () => {
    escribir('ju');
    vi.advanceTimersByTime(300);
    expect(listar).not.toHaveBeenCalled();
    escribir('jua');
    vi.advanceTimersByTime(299);
    expect(listar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    expect(listar).toHaveBeenCalledTimes(1);
    expect(listar.mock.lastCall![0].limite).toBe(6);
    const opciones = Array.from(el.querySelectorAll('[role="option"]')).map((o) => o.textContent);
    expect(opciones.some((t) => t?.includes('ABCD010101HDFXXX01'))).toBe(true);
  });

  it('descarta respuestas de consultas obsoletas', () => {
    const primera = new Subject<ServidoresPagina>();
    listar.mockReturnValueOnce(primera).mockReturnValueOnce(of(pagina('Segundo Resultado')));
    escribir('abc');
    vi.advanceTimersByTime(300);
    escribir('abcd');
    vi.advanceTimersByTime(300);
    primera.next(pagina('Obsoleto'));
    fixture.detectChanges();
    expect(el.textContent).not.toContain('Obsoleto');
    expect(el.textContent).toContain('Segundo');
  });

  it('muestra "Sin resultados" cuando nada coincide', () => {
    listar.mockReturnValue(of({ total: 0, filas: [] }));
    escribir('zzzz');
    vi.advanceTimersByTime(300);
    fixture.detectChanges();
    expect(el.textContent).toContain('Sin resultados');
  });

  it('flechas y Enter navegan y limpian el campo', () => {
    escribir('inicio');
    expect(input.getAttribute('aria-activedescendant')).toBeTruthy();
    tecla('ArrowDown');
    tecla('ArrowUp');
    tecla('Enter');
    expect(navegar).toHaveBeenCalledWith('/home');
    expect(el.querySelector('input')).toBeNull();
    expect(el.querySelector('[role="listbox"]')).toBeNull();
  });

  it('Escape limpia, colapsa a la lupa y le devuelve el foco', () => {
    escribir('rep');
    tecla('Escape');
    fixture.detectChanges();
    expect(el.querySelector('input')).toBeNull();
    expect(el.querySelector('[role="listbox"]')).toBeNull();
    expect(document.activeElement).toBe(el.querySelector('button.ico'));
  });

  it('la lupa tiene nombre accesible y abre el campo con foco', () => {
    const ico = el.querySelector('button.ico')!;
    expect(ico.getAttribute('aria-label')).toBe('Buscar (Ctrl K)');
    expect(ico.getAttribute('title')).toBe('Buscar (Ctrl K)');
    expect(document.activeElement).toBe(input);
  });

  it('perder el foco con el campo vacío colapsa a la lupa', () => {
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(el.querySelector('input')).toBeNull();
  });

  it('clic fuera colapsa aunque haya texto', () => {
    escribir('rep');
    document.body.click();
    fixture.detectChanges();
    expect(el.querySelector('input')).toBeNull();
  });

  it('Ctrl+K abre el campo y lo enfoca desde el estado colapsado', () => {
    tecla('Escape');
    fixture.detectChanges();
    expect(el.querySelector('input')).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    fixture.detectChanges();
    const nuevo = el.querySelector('input')!;
    expect(nuevo).toBeTruthy();
    expect(document.activeElement).toBe(nuevo);
  });
});
