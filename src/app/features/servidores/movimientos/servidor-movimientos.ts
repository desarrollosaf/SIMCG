import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, GridSizeChangedEvent } from 'ag-grid-community';
import { puedeEditarServidores } from '../../../core/access/acceso-por-rol';
import { AuthService } from '../../../core/services/auth.service';
import { CatalogosService, TipoMovimiento } from '../../../core/services/catalogos.service';
import {
  Movimiento,
  ServidorDetalle,
  ServidoresService,
} from '../../../core/services/servidores.service';
import { ToastService } from '../../../core/services/toast.service';
import { AccionFila, columnaAcciones } from '../../../shared/acciones/acciones-celda';
import { AG_GRID_LOCALE, simcgGridTheme } from '../../../shared/ag-grid/ag-grid-setup';
import { CeldaDosNiveles } from '../../../shared/ag-grid/celda-dos-niveles';
import { CeldaEstatus } from '../../../shared/ag-grid/celda-estatus';
import { EstadoVisual } from '../../../shared/ag-grid/estado-celda';
import { ConfirmacionService } from '../../../shared/confirmacion/confirmacion.service';
import { EstadoError, EstadoVacio } from '../../../shared/estado/estado';
import { Modal } from '../../../shared/modal/modal';
import { Paginador } from '../../../shared/paginador/paginador';
import { formatearFecha } from '../../../shared/utils/fecha';
import { cerrarModalServidores } from '../servidores-navegacion';
import { ServidoresRefresco } from '../servidores-refresco';
import { CambiarObligado } from './cambiar-obligado';
import { CeldaPdf, EstadoPdf } from './celda-pdf';

const SIN_OFICIO = 'NO HAY OFICIO';
const SIN_ENVIO = 'SIN ENVÍO';

// Igual que el sistema viejo: solo estos roles ven los PDF de la declaración.
const ROLES_PDF: readonly string[] = ['Administrador', 'Consulta'];

export function puedeVerPdf(roles: readonly string[] | null | undefined): boolean {
  return !!roles?.some((rol) => ROLES_PDF.includes(rol));
}

/** Estado de la celda de PDF: solo hay PDF si ya se envió y el rol puede verlo. */
export function estadoPdf(movimiento: Movimiento, puedeVer: boolean): EstadoPdf {
  if (!movimiento.fechaEnvio) return 'sin-envio';
  return puedeVer ? 'disponible' : 'sin-permiso';
}

// El backend devuelve el estatus sin acentos (como el sistema viejo); aquí se muestra bien escrito.
const TEXTO_ESTATUS: Record<string, string> = {
  'ENVIO EXTEMPORANEO': 'ENVÍO EXTEMPORÁNEO',
  'ENVIO EN TIEMPO': 'ENVÍO EN TIEMPO',
};

// Tono del chip de estatus (los mismos textos que calcula el backend).
export function estatusMovimiento(estatus: string | null | undefined): EstadoVisual {
  const texto = estatus ?? '';
  const visible = TEXTO_ESTATUS[texto] ?? texto;
  if (texto === 'OMISO' || texto === 'ENVIO EXTEMPORANEO') return { texto: visible, tono: 'error' };
  if (texto.startsWith('NO OBLIGADO')) return { texto: visible, tono: 'neutro' };
  return { texto: visible, tono: 'ok' };
}

// Columnas que se muestran u ocultan según el ancho del grid (la de acciones siempre).
const COLUMNAS_RESPONSIVAS = [
  'movimiento',
  'estado',
  'estadoDeclaracion',
  'oficios',
  'envio',
  'status',
  'pdf',
];

/** Columnas visibles según el ancho del grid (px): nunca hay scroll horizontal. */
export function columnasVisibles(ancho: number): string[] {
  if (ancho >= 1045) return [...COLUMNAS_RESPONSIVAS];
  if (ancho >= 930) return ['movimiento', 'estado', 'oficios', 'envio', 'status', 'pdf'];
  if (ancho >= 750) return ['movimiento', 'estado', 'envio', 'status', 'pdf'];
  if (ancho >= 550) return ['movimiento', 'estado', 'status'];
  return ['movimiento', 'estado'];
}

@Component({
  selector: 'app-servidor-movimientos',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AgGridAngular,
    Modal,
    CambiarObligado,
    EstadoVacio,
    EstadoError,
    Paginador,
  ],
  templateUrl: './servidor-movimientos.html',
  styleUrl: './servidor-movimientos.scss',
})
export class ServidorMovimientos {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly servidoresService = inject(ServidoresService);
  private readonly toastService = inject(ToastService);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly refresco = inject(ServidoresRefresco);
  private readonly catalogos = inject(CatalogosService);

  /** Parámetro `:id` de la ruta (enlazado por withComponentInputBinding). */
  readonly id = input.required<string>();

  protected readonly servidorId = computed(() => Number(this.id()));
  protected readonly servidor = signal<ServidorDetalle | null>(null);
  protected readonly movimientos = signal<Movimiento[]>([]);
  protected readonly permitidos = signal<TipoMovimiento[]>([]);
  protected readonly cargando = signal(true);
  protected readonly conError = signal(false);
  protected readonly guardando = signal(false);
  protected readonly dependencia = signal<string | null>(null);
  protected readonly editandoObligado = signal<Movimiento | null>(null);
  protected readonly paginaGrid = signal(0);
  protected readonly limiteGrid = signal(10);
  private api: GridApi<Movimiento> | undefined;

  protected readonly puedeEditar = computed(() =>
    puedeEditarServidores(this.authService.currentUser()?.roles),
  );
  protected readonly puedeVerPdf = computed(() =>
    puedeVerPdf(this.authService.currentUser()?.roles),
  );
  protected readonly nombreServidor = computed(() => {
    const s = this.servidor();
    return s ? [s.nombre, s.primerApellido, s.segundoApellido].filter(Boolean).join(' ') : '';
  });
  protected readonly subtitulo = computed(() => {
    const s = this.servidor();
    if (!s) return 'Cargando…';
    return [s.curp, this.dependencia()].filter(Boolean).join(' · ');
  });

  protected readonly form = this.fb.group({
    tipoMovimientoId: [null as number | null, [Validators.required]],
  });

  protected readonly gridTheme = simcgGridTheme;
  protected readonly localeText = AG_GRID_LOCALE;

  protected readonly acciones: AccionFila<Movimiento>[] = [
    {
      etiqueta: 'Cambiar status',
      icono: 'editar',
      visible: () => this.puedeEditar(),
      ejecutar: (m) => this.editandoObligado.set(m),
    },
  ];

  protected readonly columnas: ColDef<Movimiento>[] = [
    {
      colId: 'movimiento',
      headerName: 'Tipo y fecha de movimiento',
      minWidth: 150,
      flex: 1.3,
      cellRenderer: CeldaDosNiveles,
      cellRendererParams: {
        principal: (m: Movimiento) => m.tipo,
        secundario: (m: Movimiento) => formatearFecha(m.fechaDeclaracion),
      },
    },
    {
      colId: 'estado',
      headerName: 'Estado',
      minWidth: 170,
      flex: 1.1,
      cellRenderer: CeldaEstatus,
      cellRendererParams: { estatus: (m: Movimiento) => estatusMovimiento(m.estatus) },
    },
    {
      colId: 'estadoDeclaracion',
      headerName: 'Estado declaración',
      minWidth: 120,
      flex: 0.8,
      cellRenderer: CeldaDosNiveles,
      cellRendererParams: { principal: (m: Movimiento) => m.estatusDeclaracion },
    },
    {
      colId: 'oficios',
      headerName: 'Oficio preventivo y de remisión',
      minWidth: 175,
      flex: 1.6,
      cellRenderer: CeldaDosNiveles,
      cellRendererParams: {
        principal: (m: Movimiento) => `Preventivo: ${m.oficioPreventivo ?? SIN_OFICIO}`,
        secundario: (m: Movimiento) => `Remisión: ${m.oficioRemision ?? SIN_OFICIO}`,
      },
    },
    {
      colId: 'envio',
      headerName: 'Envío',
      minWidth: 118,
      flex: 0.8,
      cellRenderer: CeldaDosNiveles,
      cellRendererParams: {
        principal: (m: Movimiento) => formatearFecha(m.fechaEnvio) || SIN_ENVIO,
      },
    },
    {
      colId: 'status',
      headerName: 'Status',
      minWidth: 110,
      flex: 1.2,
      cellRenderer: CeldaDosNiveles,
      cellRendererParams: { principal: (m: Movimiento) => m.estado },
    },
    {
      colId: 'pdf',
      headerName: 'PDF',
      minWidth: 100,
      flex: 0.8,
      cellRenderer: CeldaPdf,
      cellRendererParams: {
        estado: (m: Movimiento) => estadoPdf(m, this.puedeVerPdf()),
        pdf: (m: Movimiento, privada: boolean) =>
          this.servidoresService.pdfDeclaracion(this.servidorId(), m.id, privada),
      },
    },
    columnaAcciones(this.acciones),
  ];

  constructor() {
    // Carga inicial y recarga si el router reutiliza el componente con otro :id.
    effect(() => {
      const id = this.servidorId();
      untracked(() => this.iniciar(id));
    });
  }

  // Encabezados largos en dos líneas en lugar de ensanchar la columna.
  protected readonly columnaBase: ColDef<Movimiento> = {
    wrapText: true,
    autoHeight: true,
    wrapHeaderText: true,
    autoHeaderHeight: true,
  };

  alIniciarGrid(evento: GridReadyEvent<Movimiento>): void {
    this.api = evento.api;
  }

  /** Oculta columnas secundarias cuando el modal es angosto (sin scroll horizontal). */
  alCambiarTamano(evento: GridSizeChangedEvent<Movimiento>): void {
    this.ajustarColumnas(evento.clientWidth);
  }

  private ajustarColumnas(ancho: number | undefined): void {
    if (!this.api || !ancho) return;
    const visibles = columnasVisibles(ancho);
    this.api.setColumnsVisible(
      COLUMNAS_RESPONSIVAS.filter((c) => !visibles.includes(c)),
      false,
    );
    this.api.setColumnsVisible(visibles, true);
  }

  /** Sincroniza el paginador propio con la paginación interna de ag-grid. */
  alPaginar(): void {
    if (!this.api) return;
    this.paginaGrid.set(this.api.paginationGetCurrentPage());
    this.limiteGrid.set(this.api.paginationGetPageSize());
  }

  irAPaginaGrid(pagina: number): void {
    this.api?.paginationGoToPage(pagina);
  }

  cambiarLimiteGrid(limite: number): void {
    this.api?.setGridOption('paginationPageSize', limite);
  }

  cerrar(): void {
    void cerrarModalServidores(this.router);
  }

  /** Registra el movimiento elegido, previa confirmación (la fecha es la de hoy). */
  async guardar(): Promise<void> {
    if (this.form.invalid || this.guardando()) {
      this.form.markAllAsTouched();
      return;
    }

    const tipoId = Number(this.form.controls.tipoMovimientoId.value);
    const tipo = this.permitidos().find((t) => t.id === tipoId);
    const acepta = await this.confirmacion.confirmar({
      titulo: '¿Registrar el movimiento?',
      mensaje: `Se registrará un movimiento de tipo ${tipo?.valor ?? 'seleccionado'} con la fecha de hoy.`,
      textoConfirmar: 'Registrar',
    });
    if (!acepta) return;

    this.guardando.set(true);
    this.servidoresService.crearMovimiento(this.servidorId(), tipoId).subscribe({
      next: () => {
        this.guardando.set(false);
        this.toastService.success('Movimiento registrado correctamente');
        this.form.reset({ tipoMovimientoId: null });
        this.alCambiar();
      },
      error: (err: unknown) => {
        this.guardando.set(false);
        this.toastService.errorHttp(err, 'No se pudo registrar el movimiento.');
        this.cargar();
      },
    });
  }

  alGuardarObligado(): void {
    this.editandoObligado.set(null);
    this.alCambiar();
  }

  cargar(): void {
    const id = this.servidorId();
    this.cargando.set(true);
    this.conError.set(false);
    this.servidoresService.movimientos(id).subscribe({
      next: (filas) => {
        if (id !== this.servidorId()) return;
        this.movimientos.set(filas);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        if (id !== this.servidorId()) return;
        this.cargando.set(false);
        this.conError.set(true);
        this.toastService.errorHttp(err, 'No se pudo cargar el historial de movimientos.');
      },
    });
    this.servidoresService.movimientosPermitidos(id).subscribe({
      next: (tipos) => {
        if (id === this.servidorId()) this.permitidos.set(tipos);
      },
      error: (err: unknown) =>
        this.toastService.errorHttp(err, 'No se pudieron cargar los movimientos permitidos.'),
    });
  }

  /** El detalle solo trae el id de la dependencia; el nombre sale del catálogo (opcional). */
  private resolverDependencia(dependenciaId: number | null | undefined): void {
    if (!dependenciaId) return;
    this.catalogos.dependencias().subscribe({
      next: (lista) => {
        const d = lista.find((x) => x.id === dependenciaId);
        if (d) this.dependencia.set(d.nombre);
      },
      error: () => undefined,
    });
  }

  /** Tras cualquier cambio: recarga historial y permitidos, y avisa a la lista. */
  private alCambiar(): void {
    this.cargar();
    this.refresco.notificar();
  }

  private iniciar(id: number): void {
    this.servidor.set(null);
    this.dependencia.set(null);
    this.movimientos.set([]);
    this.permitidos.set([]);
    this.editandoObligado.set(null);
    this.form.reset({ tipoMovimientoId: null });
    this.servidoresService.detalle(id).subscribe({
      next: (s) => {
        if (id !== this.servidorId()) return;
        this.servidor.set(s);
        this.resolverDependencia(s.tipoDependenciaId);
      },
      error: (err: unknown) => {
        this.toastService.errorHttp(err, 'No se pudo cargar el servidor público.');
        this.cerrar();
      },
    });
    this.cargar();
  }
}
