import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterOutlet } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, SortChangedEvent } from 'ag-grid-community';
import { map } from 'rxjs';
import { puedeEditarServidores } from '../../../core/access/acceso-por-rol';
import { AuthService } from '../../../core/services/auth.service';
import { CatalogosService, Dependencia } from '../../../core/services/catalogos.service';
import { ServidorFila, ServidoresService } from '../../../core/services/servidores.service';
import { ToastService } from '../../../core/services/toast.service';
import { AccionFila, columnaAcciones } from '../../../shared/acciones/acciones-celda';
import {
  AG_GRID_COLUMNA_BASE,
  AG_GRID_LOCALE,
  simcgGridTheme,
} from '../../../shared/ag-grid/ag-grid-setup';
import { CeldaDosNiveles } from '../../../shared/ag-grid/celda-dos-niveles';
import { CeldaEstatus } from '../../../shared/ag-grid/celda-estatus';
import { ListaTarjetas } from '../../../shared/ag-grid/lista-tarjetas';
import { BarraAcciones } from '../../../shared/barra/barra-acciones';
import { FiltrosPopover } from '../../../shared/barra/filtros-popover';
import { EstadoError, EstadoVacio } from '../../../shared/estado/estado';
import { Icono } from '../../../shared/icono/icono';
import { Paginador } from '../../../shared/paginador/paginador';
import { abrirModalServidores } from '../servidores-navegacion';
import { ServidoresRefresco } from '../servidores-refresco';
import { BajaServidor } from './baja-servidor';
import {
  adscripcion,
  estatusServidor,
  fechaUltimoMovimiento,
  tipoUltimoMovimiento,
} from './servidores-presentacion';
import {
  ESTADO_INICIAL,
  EstadoLista,
  TAMANOS_PAGINA,
  aQueryParams,
  filtrosActivos,
  leerEstado,
  mismoEstado,
} from './servidores-url';

const ESPERA_BUSQUEDA_MS = 350;
const CONSULTA_MOVIL = '(max-width: 767.98px)';
const CONSULTA_MEDIA = '(max-width: 1100px)';
// El orden lo hace el servidor; el grid no debe reordenar la página.
const SIN_ORDEN_LOCAL = () => 0;

@Component({
  selector: 'app-servidores-lista',
  standalone: true,
  imports: [
    AgGridAngular,
    RouterOutlet,
    BarraAcciones,
    EstadoVacio,
    EstadoError,
    Icono,
    Paginador,
    BajaServidor,
    ListaTarjetas,
    FiltrosPopover,
  ],
  templateUrl: './servidores-lista.html',
  styleUrl: './servidores-lista.scss',
})
export class ServidoresLista implements OnDestroy {
  private readonly servidoresService = inject(ServidoresService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly refresco = inject(ServidoresRefresco);
  private readonly catalogos = inject(CatalogosService);
  private readonly breakpoints = inject(BreakpointObserver);

  protected readonly filas = signal<ServidorFila[]>([]);
  protected readonly total = signal(0);
  protected readonly cargando = signal(true);
  protected readonly yaCargo = signal(false);
  protected readonly conError = signal(false);
  protected readonly estado = signal<EstadoLista>(ESTADO_INICIAL);
  /** Texto del buscador; se aplica a la URL con espera. */
  protected readonly textoBusqueda = signal('');
  protected readonly bajaFila = signal<ServidorFila | null>(null);
  protected readonly tamanosPagina = TAMANOS_PAGINA;
  protected readonly dependencias = signal<Dependencia[]>([]);
  /** Menos de 768 px: tarjetas en lugar de tabla. */
  protected readonly esMovil = toSignal(
    this.breakpoints.observe(CONSULTA_MOVIL).pipe(map((r) => r.matches)),
    { initialValue: false },
  );
  /** Menos de 1100 px: se oculta la columna secundaria «Último movimiento». */
  protected readonly esMedio = toSignal(
    this.breakpoints.observe(CONSULTA_MEDIA).pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  protected readonly puedeEditar = computed(() =>
    puedeEditarServidores(this.authService.currentUser()?.roles),
  );
  protected readonly buscar = computed(() => this.estado().buscar);
  protected readonly pagina = computed(() => this.estado().pagina);
  protected readonly limite = computed(() => this.estado().limite);
  protected readonly paginas = computed(() => Math.max(1, Math.ceil(this.total() / this.limite())));
  protected readonly soloActivos = computed(() => this.estado().estatus === 'activos');
  protected readonly soloObligados = computed(() => this.estado().obligado);
  protected readonly dependenciaId = computed(() => this.estado().dependenciaId);
  protected readonly filtros = computed(() => filtrosActivos(this.estado()));
  protected readonly hayFiltros = computed(() => this.buscar() !== '' || this.filtros() > 0);

  protected readonly gridTheme = simcgGridTheme;
  protected readonly localeText = AG_GRID_LOCALE;
  protected readonly columnaBase = AG_GRID_COLUMNA_BASE;
  protected readonly obtenerIdFila = (p: { data: ServidorFila }) => String(p.data.id);

  // Presentación de las tarjetas móviles (las mismas filas que el grid).
  protected readonly idTarjeta = (f: ServidorFila) => f.id;
  protected readonly tituloTarjeta = (f: ServidorFila) => f.nombre;
  protected readonly subtituloTarjeta = (f: ServidorFila) => f.curp;
  protected readonly detalleTarjeta = adscripcion;
  protected readonly estatusTarjeta = estatusServidor;

  // Un servidor dado de baja ya no se puede consultar ni editar (el borrado es lógico).
  private readonly noEsBaja = (fila: ServidorFila) => fila.estatus !== 'baja';

  protected readonly acciones: AccionFila<ServidorFila>[] = [
    {
      etiqueta: 'Ver movimientos',
      icono: 'lista',
      visible: this.noEsBaja,
      ejecutar: (fila) => this.verMovimientos(fila),
    },
    {
      etiqueta: 'Editar',
      icono: 'editar',
      visible: (fila) => this.noEsBaja(fila) && this.puedeEditar(),
      ejecutar: (fila) => this.editar(fila),
    },
    {
      etiqueta: 'Dar de baja',
      icono: 'basura',
      peligro: true,
      visible: (fila) => this.noEsBaja(fila) && this.puedeEditar(),
      ejecutar: (fila) => this.bajaFila.set(fila),
    },
  ];
  protected readonly columnas: ColDef<ServidorFila>[] = this.definirColumnas(
    leerEstado(this.route.snapshot.queryParamMap),
  );

  private api: GridApi<ServidorFila> | undefined;
  private temporizador: ReturnType<typeof setTimeout> | undefined;
  private peticion = 0;
  private cargada: EstadoLista | undefined;

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((p) => this.aplicarUrl(p));
    this.refresco.cambios$.pipe(takeUntilDestroyed()).subscribe(() => this.cargar());
    this.catalogos
      .dependencias()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (lista) => this.dependencias.set(lista),
        // El filtro por dependencia es opcional: sin catálogo la lista sigue funcionando.
        error: () => this.dependencias.set([]),
      });
    // Entre 768 y 1100 px se oculta la columna secundaria para evitar scroll horizontal.
    effect(() => {
      const oculta = this.esMedio();
      this.api?.setColumnsVisible(['ultimoMovimiento'], !oculta);
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.temporizador);
  }

  nuevo(): void {
    void abrirModalServidores(this.router, 'nuevo');
  }

  alEscribir(evento: Event): void {
    const texto = (evento.target as HTMLInputElement).value;
    this.textoBusqueda.set(texto);
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => {
      this.temporizador = undefined;
      this.navegar({ buscar: texto.trim(), pagina: 0 });
    }, ESPERA_BUSQUEDA_MS);
  }

  limpiarBusqueda(): void {
    clearTimeout(this.temporizador);
    this.temporizador = undefined;
    this.textoBusqueda.set('');
    this.navegar({ buscar: '', pagina: 0 });
  }

  alternarActivos(): void {
    this.navegar({ estatus: this.soloActivos() ? 'todos' : 'activos', pagina: 0 });
  }

  alternarObligados(): void {
    // La obligación solo aplica a servidores activos.
    const obligado = !this.soloObligados();
    this.navegar({ obligado, ...(obligado ? { estatus: 'activos' as const } : {}), pagina: 0 });
  }

  cambiarDependencia(evento: Event): void {
    const id = Number.parseInt((evento.target as HTMLSelectElement).value, 10);
    this.navegar({ dependenciaId: Number.isFinite(id) ? id : null, pagina: 0 });
  }

  /** Quita búsqueda y filtros rápidos. */
  limpiarFiltros(): void {
    clearTimeout(this.temporizador);
    this.temporizador = undefined;
    this.textoBusqueda.set('');
    this.navegar({
      buscar: '',
      estatus: ESTADO_INICIAL.estatus,
      obligado: false,
      dependenciaId: null,
      pagina: 0,
    });
  }

  cambiarLimite(limite: number): void {
    this.navegar({ limite, pagina: 0 });
  }

  irAPagina(pagina: number): void {
    if (pagina < 0 || pagina >= this.paginas()) return;
    this.navegar({ pagina });
  }

  alIniciarGrid(evento: GridReadyEvent<ServidorFila>): void {
    this.api = evento.api;
    this.api.setColumnsVisible(['ultimoMovimiento'], !this.esMedio());
  }

  alOrdenar(evento: SortChangedEvent<ServidorFila>): void {
    const columna = evento.api.getColumnState().find((c) => c.sort);
    // Sin columna ordenada (p. ej. tras limpiar el orden) se vuelve al orden por nombre.
    const ordenar = columna?.colId === 'dependencia' ? 'dependencia' : 'nombre';
    this.navegar({
      ordenar,
      direccion: columna?.sort === 'desc' ? 'desc' : 'asc',
      pagina: 0,
    });
  }

  alDarDeBaja(): void {
    this.bajaFila.set(null);
    this.cargar();
  }

  cargar(): void {
    const id = ++this.peticion;
    const consulta = this.estado();
    this.cargando.set(true);
    this.conError.set(false);
    this.servidoresService
      .listar({
        inicio: consulta.pagina * consulta.limite,
        limite: consulta.limite,
        buscar: consulta.buscar,
        ordenar: consulta.ordenar,
        direccion: consulta.direccion,
        estatus: consulta.estatus,
        obligado: consulta.obligado,
        dependenciaId: consulta.dependenciaId,
      })
      .subscribe({
        next: (pagina) => {
          if (id !== this.peticion) return;
          this.filas.set(pagina.filas);
          this.total.set(pagina.total);
          this.cargando.set(false);
          this.yaCargo.set(true);
          // La página quedó fuera de rango (p. ej. tras una baja): se va a la última.
          if (pagina.filas.length === 0 && pagina.total > 0 && consulta.pagina > 0) {
            this.navegar({ pagina: this.paginas() - 1 });
          }
        },
        error: (err: unknown) => {
          if (id !== this.peticion) return;
          this.cargando.set(false);
          this.conError.set(true);
          this.toastService.errorHttp(err, 'No se pudieron cargar los servidores públicos.');
        },
      });
  }

  private aplicarUrl(params: ParamMap): void {
    const nuevo = leerEstado(params);
    if (this.cargada && mismoEstado(this.cargada, nuevo)) return;

    this.cargada = nuevo;
    this.estado.set(nuevo);
    if (this.temporizador === undefined) this.textoBusqueda.set(nuevo.buscar);
    this.aplicarOrdenEnGrid(nuevo);
    this.cargar();
  }

  /** Actualiza la URL (sin agregar historial); la lista se recarga al leerla de vuelta. */
  private navegar(cambios: Partial<EstadoLista>): void {
    const nuevo = { ...this.estado(), ...cambios };
    if (mismoEstado(nuevo, this.estado())) return;
    void this.router.navigate([], {
      queryParams: aQueryParams(nuevo),
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private aplicarOrdenEnGrid(estado: EstadoLista): void {
    this.api?.applyColumnState({
      state: [{ colId: estado.ordenar, sort: estado.direccion }],
      defaultState: { sort: null },
    });
  }

  private verMovimientos(fila: ServidorFila): void {
    void abrirModalServidores(this.router, fila.id, 'movimientos');
  }

  private editar(fila: ServidorFila): void {
    void abrirModalServidores(this.router, fila.id, 'editar');
  }

  private definirColumnas(inicial: EstadoLista): ColDef<ServidorFila>[] {
    return [
      {
        colId: 'nombre',
        headerName: 'Servidor público',
        minWidth: 240,
        flex: 2,
        sortable: true,
        sort: inicial.ordenar === 'nombre' ? inicial.direccion : undefined,
        comparator: SIN_ORDEN_LOCAL,
        cellRenderer: CeldaDosNiveles,
        cellRendererParams: {
          avatar: true,
          monoSecundario: true,
          principal: (f: ServidorFila) => f.nombre,
          secundario: (f: ServidorFila) => f.curp,
        },
      },
      {
        colId: 'dependencia',
        headerName: 'Dependencia / dirección',
        minWidth: 200,
        flex: 1.7,
        sortable: true,
        sort: inicial.ordenar === 'dependencia' ? inicial.direccion : undefined,
        comparator: SIN_ORDEN_LOCAL,
        cellRenderer: CeldaDosNiveles,
        cellRendererParams: {
          principal: (f: ServidorFila) => f.dependencia ?? '—',
          secundario: (f: ServidorFila) => f.direccion,
        },
      },
      {
        colId: 'ultimoMovimiento',
        headerName: 'Último movimiento',
        minWidth: 150,
        flex: 1,
        sortable: false,
        cellRenderer: CeldaDosNiveles,
        cellRendererParams: {
          principal: tipoUltimoMovimiento,
          secundario: fechaUltimoMovimiento,
        },
      },
      {
        colId: 'estatus',
        headerName: 'Estatus',
        width: 150,
        minWidth: 130,
        sortable: false,
        cellRenderer: CeldaEstatus,
        cellRendererParams: { estatus: estatusServidor },
      },
      columnaAcciones(this.acciones),
    ];
  }
}
