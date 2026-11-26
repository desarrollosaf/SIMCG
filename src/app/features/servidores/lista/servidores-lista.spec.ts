import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { CatalogosService } from '../../../core/services/catalogos.service';
import { ServidoresService } from '../../../core/services/servidores.service';
import { ToastService } from '../../../core/services/toast.service';
import { ListaTarjetas } from '../../../shared/ag-grid/lista-tarjetas';
import { FiltrosPopover } from '../../../shared/barra/filtros-popover';
import { BarraAcciones } from '../../../shared/barra/barra-acciones';
import { EstadoError, EstadoVacio } from '../../../shared/estado/estado';
import { Icono } from '../../../shared/icono/icono';
import { Paginador } from '../../../shared/paginador/paginador';
import { ServidoresRefresco } from '../servidores-refresco';
import { BajaServidor } from './baja-servidor';
import { ServidoresLista } from './servidores-lista';
import { aQueryParams, filtrosActivos, leerEstado } from './servidores-url';

const pagina = (total: number) => ({
  total,
  filas: total
    ? [
        {
          id: 1,
          nombre: 'ANA',
          curp: 'X',
          dependencia: 'D',
          direccion: null,
          estatus: 'obligado' as const,
          obligado: true,
          ultimoMovimiento: { tipo: 'INGRESO', fecha: '2026-03-12' },
        },
      ]
    : [],
});

describe('servidores-url', () => {
  it('lee el estado con valores por defecto y descarta inválidos', () => {
    expect(leerEstado(convertToParamMap({}))).toEqual({
      buscar: '',
      pagina: 0,
      limite: 10,
      ordenar: 'nombre',
      direccion: 'asc',
      estatus: 'activos',
      obligado: false,
      dependenciaId: null,
    });
    const e = leerEstado(
      convertToParamMap({ buscar: ' ana ', pagina: '3', limite: '99', orden: 'curp', dir: 'desc' }),
    );
    expect(e).toEqual({
      buscar: 'ana',
      pagina: 2,
      limite: 10,
      ordenar: 'curp',
      direccion: 'desc',
      estatus: 'activos',
      obligado: false,
      dependenciaId: null,
    });
  });

  it('«obligado» implica estatus activos aunque la URL pida otro', () => {
    const e = leerEstado(convertToParamMap({ estatus: 'baja', obligado: '1' }));
    expect(e).toEqual(expect.objectContaining({ estatus: 'activos', obligado: true }));
  });

  it('lee el orden por dependencia', () => {
    expect(leerEstado(convertToParamMap({ orden: 'dependencia', dir: 'desc' }))).toEqual(
      expect.objectContaining({ ordenar: 'dependencia', direccion: 'desc' }),
    );
  });

  it('lee los filtros rápidos de la URL y descarta valores inválidos', () => {
    const e = leerEstado(convertToParamMap({ estatus: 'todos', dependencia: '7' }));
    expect(e).toEqual(expect.objectContaining({ estatus: 'todos', dependenciaId: 7 }));
    const malo = leerEstado(convertToParamMap({ estatus: 'x', obligado: 'si', dependencia: '-2' }));
    expect(malo).toEqual(
      expect.objectContaining({ estatus: 'activos', obligado: false, dependenciaId: null }),
    );
    expect(aQueryParams(e)).toEqual(
      expect.objectContaining({ estatus: 'todos', obligado: null, dependencia: 7 }),
    );
    expect(filtrosActivos(e)).toBe(2);
    expect(filtrosActivos(malo)).toBe(0);
  });

  it('quita de la URL los valores por defecto', () => {
    expect(aQueryParams(leerEstado(convertToParamMap({})))).toEqual({
      buscar: null,
      pagina: null,
      limite: null,
      orden: null,
      dir: null,
      estatus: null,
      obligado: null,
      dependencia: null,
    });
  });
});

describe('ServidoresLista', () => {
  const servicio = { listar: vi.fn() };
  const toast = { errorHttp: vi.fn(), success: vi.fn() };
  const router = { navigate: vi.fn().mockResolvedValue(true) };
  const catalogos = { dependencias: vi.fn() };
  const consulta = (extra: object = {}) => ({
    inicio: 0,
    limite: 10,
    buscar: '',
    ordenar: 'nombre',
    direccion: 'asc',
    estatus: 'activos',
    obligado: false,
    dependenciaId: null,
    ...extra,
  });
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  const crear = (consulta: Record<string, string> = {}, roles = ['Administrador']) => {
    params = new BehaviorSubject(convertToParamMap(consulta));
    TestBed.configureTestingModule({
      errorOnUnknownElements: false,
      errorOnUnknownProperties: false,
      providers: [
        ServidoresRefresco,
        { provide: ServidoresService, useValue: servicio },
        { provide: ToastService, useValue: toast },
        { provide: CatalogosService, useValue: catalogos },
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: { currentUser: signal({ roles }) } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: params.value }, queryParamMap: params },
        },
      ],
    });
    // El grid de ag-grid no se monta en estas pruebas.
    TestBed.overrideComponent(ServidoresLista, {
      set: {
        imports: [
          BarraAcciones,
          EstadoVacio,
          EstadoError,
          Icono,
          Paginador,
          BajaServidor,
          ListaTarjetas,
          FiltrosPopover,
        ],
      },
    });
    const fixture = TestBed.createComponent(ServidoresLista);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    servicio.listar.mockReturnValue(of(pagina(100)));
    catalogos.dependencias.mockReturnValue(of([{ id: 4, nombre: 'TESORERIA' }]));
  });

  it('carga con la consulta por defecto', () => {
    crear();
    expect(servicio.listar).toHaveBeenCalledWith(consulta());
  });

  it('lee buscar, página, límite y orden de la URL y recarga al cambiar', () => {
    crear({ buscar: 'ana', pagina: '3', limite: '20', orden: 'curp', dir: 'desc' });
    expect(servicio.listar).toHaveBeenLastCalledWith(
      consulta({ inicio: 40, limite: 20, buscar: 'ana', ordenar: 'curp', direccion: 'desc' }),
    );

    params.next(convertToParamMap({ pagina: '2' }));
    expect(servicio.listar).toHaveBeenCalledTimes(2);
    expect(servicio.listar).toHaveBeenLastCalledWith(
      expect.objectContaining({ inicio: 10, buscar: '' }),
    );
  });

  it('no recarga si la URL emite el mismo estado', () => {
    crear({ pagina: '2' });
    params.next(convertToParamMap({ pagina: '2' }));
    expect(servicio.listar).toHaveBeenCalledTimes(1);
  });

  it('escribe el estado en la URL con replaceUrl al paginar', () => {
    const c: any = crear().componentInstance;
    c.irAPagina(2);
    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: {
        buscar: null,
        pagina: 3,
        limite: null,
        orden: null,
        dir: null,
        estatus: null,
        obligado: null,
        dependencia: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  });

  it('la búsqueda se escribe en la URL con espera y vuelve a la página 1', () => {
    vi.useFakeTimers();
    try {
      const c: any = crear({ pagina: '4' }).componentInstance;
      c.alEscribir({ target: { value: ' luis ' } } as unknown as Event);
      expect(router.navigate).not.toHaveBeenCalled();
      vi.advanceTimersByTime(400);
      expect(router.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: expect.objectContaining({ buscar: 'luis', pagina: null }),
          replaceUrl: true,
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('sin datos muestra el estado vacío; con búsqueda ofrece limpiar', () => {
    servicio.listar.mockReturnValue(of(pagina(0)));
    const vacio = crear();
    expect(vacio.nativeElement.textContent).toContain('Aún no hay servidores');
    TestBed.resetTestingModule();

    const busqueda = crear({ buscar: 'zzz' });
    const el: HTMLElement = busqueda.nativeElement;
    expect(el.textContent).toContain('Sin resultados');
    const limpiar = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Limpiar filtros'),
    );
    limpiar!.click();
    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: expect.objectContaining({ buscar: null }) }),
    );
  });

  it('ante un error muestra el estado de error y Reintentar vuelve a cargar', () => {
    servicio.listar.mockReturnValue(throwError(() => ({ status: 500 })));
    const fixture = crear();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    expect(toast.errorHttp).toHaveBeenCalled();

    servicio.listar.mockReturnValue(of(pagina(100)));
    (fixture.componentInstance as any).cargar();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    expect(servicio.listar).toHaveBeenCalledTimes(2);
  });

  it('el aviso de refresco recarga la lista conservando la página', () => {
    crear({ pagina: '3' });
    TestBed.inject(ServidoresRefresco).notificar();
    expect(servicio.listar).toHaveBeenCalledTimes(2);
    expect(servicio.listar).toHaveBeenLastCalledWith(expect.objectContaining({ inicio: 20 }));
  });

  it('abre los modales hijos conservando los query params', () => {
    const c: any = crear().componentInstance;
    c.nuevo();
    expect(router.navigate).toHaveBeenCalledWith(['/servidores', 'nuevo'], {
      queryParamsHandling: 'preserve',
    });
  });

  it('descarta resultados de peticiones obsoletas', () => {
    const lenta = new Subject<ReturnType<typeof pagina>>();
    servicio.listar.mockReturnValueOnce(lenta).mockReturnValueOnce(of(pagina(5)));
    const c: any = crear().componentInstance;
    c.cargar();
    lenta.next(pagina(999));
    expect(c.total()).toBe(5);
  });

  describe('filtros rápidos', () => {
    it('Activos y Obligados se reflejan en la URL y en la consulta', () => {
      const f = crear();
      const c: any = f.componentInstance;
      c.alternarActivos();
      expect(router.navigate).toHaveBeenLastCalledWith(
        [],
        expect.objectContaining({
          queryParams: expect.objectContaining({ estatus: 'todos', pagina: null }),
        }),
      );
      c.alternarObligados();
      // Obligados solo aplica a activos: vuelve a «activos» (quita estatus de la URL).
      expect(router.navigate).toHaveBeenLastCalledWith(
        [],
        expect.objectContaining({
          queryParams: expect.objectContaining({ obligado: 1, estatus: null }),
        }),
      );

      params.next(convertToParamMap({ estatus: 'todos', obligado: '1', dependencia: '4' }));
      expect(servicio.listar).toHaveBeenLastCalledWith(
        consulta({ estatus: 'activos', obligado: true, dependenciaId: 4 }),
      );
    });

    const abrirFiltros = (f: ComponentFixture<ServidoresLista>) => {
      (f.nativeElement.querySelector('.boton-filtros') as HTMLElement).click();
      f.detectChanges();
    };

    it('la barra solo muestra buscador, Filtros y el botón primario', () => {
      const f = crear({ obligado: '1', dependencia: '4' });
      const el: HTMLElement = f.nativeElement;
      expect(el.querySelector('.chip-filtro')).toBeNull();
      expect(el.querySelector('.filtro-dependencia')).toBeNull();
      expect(el.querySelector('.boton-filtros .insignia')?.textContent?.trim()).toBe('2');
      expect(el.querySelector('.btn--primary')?.textContent).toContain('Nuevo servidor');
    });

    it('el popover refleja el estado en sus casillas ', () => {
      const f = crear({ obligado: '1' });
      abrirFiltros(f);
      const checks = document.querySelectorAll<HTMLInputElement>('.filtro-check input');
      expect(checks[0].checked).toBe(true);
      expect(checks[1].checked).toBe(true);
    });

    it('el select de dependencia usa el catálogo y actualiza la URL', () => {
      const f = crear({ dependencia: '4' });
      abrirFiltros(f);
      const select = document.querySelector('.filtro-campo select') as HTMLSelectElement;
      expect(Array.from(select.options).map((o) => o.textContent?.trim())).toEqual([
        'Todas las dependencias',
        'TESORERIA',
      ]);
      expect(select.value).toBe('4');

      select.value = '';
      select.dispatchEvent(new Event('change'));
      expect(router.navigate).toHaveBeenLastCalledWith(
        [],
        expect.objectContaining({
          queryParams: expect.objectContaining({ dependencia: null, pagina: null }),
        }),
      );
    });

    it('si falla el catálogo la lista sigue funcionando', () => {
      catalogos.dependencias.mockReturnValue(throwError(() => ({ status: 500 })));
      const f = crear();
      abrirFiltros(f);
      expect(servicio.listar).toHaveBeenCalled();
      expect(document.querySelector('.filtro-campo select')).toBeTruthy();
    });

    it('«Limpiar filtros» del popover quita los filtros de la URL', () => {
      const f = crear({ obligado: '1' });
      abrirFiltros(f);
      (document.querySelector('.panel__pie button') as HTMLElement).click();
      expect(router.navigate).toHaveBeenLastCalledWith(
        [],
        expect.objectContaining({
          queryParams: expect.objectContaining({ obligado: null }),
        }),
      );
    });

    it('limpiar filtros quita búsqueda y filtros de la URL', () => {
      const c: any = crear({ buscar: 'ana', obligado: '1', estatus: 'todos' }).componentInstance;
      c.limpiarFiltros();
      expect(router.navigate).toHaveBeenLastCalledWith(
        [],
        expect.objectContaining({
          queryParams: expect.objectContaining({
            buscar: null,
            estatus: null,
            obligado: null,
            dependencia: null,
          }),
        }),
      );
    });

    it('sin resultados con filtros ofrece limpiarlos', () => {
      servicio.listar.mockReturnValue(of(pagina(0)));
      const f = crear({ obligado: '1' });
      expect(f.nativeElement.textContent).toContain('No hay servidores públicos con esos filtros');
    });
  });

  describe('fila y acciones', () => {
    const fila = (estatus: string) => ({ id: 9, estatus }) as never;

    it('la fila no abre nada al hacer clic ni con Enter (el texto se puede copiar)', () => {
      const c: any = crear().componentInstance;
      expect(c.abrirFila).toBeUndefined();
      expect(c.alClicFila).toBeUndefined();
      expect(c.alTeclearCelda).toBeUndefined();
    });

    it('el menú ofrece Ver, Editar y Dar de baja (peligro al final) según rol y estatus', () => {
      const visibles = (c: any, estatus: string) =>
        c.acciones
          .filter((a: any) => a.visible?.(fila(estatus)) ?? true)
          .map((a: any) => a.etiqueta);
      const admin: any = crear().componentInstance;
      expect(visibles(admin, 'obligado')).toEqual(['Ver movimientos', 'Editar', 'Dar de baja']);
      expect(admin.acciones.at(-1).peligro).toBe(true);
      expect(visibles(admin, 'baja')).toEqual([]);

      TestBed.resetTestingModule();
      const lector: any = crear({}, ['Consulta']).componentInstance;
      expect(visibles(lector, 'obligado')).toEqual(['Ver movimientos']);
    });
  });
});
