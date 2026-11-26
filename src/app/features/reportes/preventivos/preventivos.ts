import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, SortChangedEvent } from 'ag-grid-community';
import { map } from 'rxjs';
import { FilaReporte, ReportesService } from '../../../core/services/reportes.service';
import { ToastService } from '../../../core/services/toast.service';
import { AccionFila } from '../../../shared/acciones/acciones-celda';
import {
  AG_GRID_COLUMNA_BASE,
  AG_GRID_LOCALE,
  simcgGridTheme,
} from '../../../shared/ag-grid/ag-grid-setup';
import { BotonIconoCelda } from '../../../shared/ag-grid/boton-icono-celda';
import { ListaTarjetas } from '../../../shared/ag-grid/lista-tarjetas';
import { BarraAcciones } from '../../../shared/barra/barra-acciones';
import { ConfirmacionService } from '../../../shared/confirmacion/confirmacion.service';
import { EstadoError, EstadoVacio } from '../../../shared/estado/estado';
import { Icono } from '../../../shared/icono/icono';
import { Paginador } from '../../../shared/paginador/paginador';
import { OficioPreventivoModal } from '../modales/oficio-preventivo-modal';
import { ReporteCorreosModal } from '../modales/reporte-correos-modal';
import { columnasReporte, ordenDeGrid } from '../reportes-columnas';
import {
  Orden,
  TAMANOS_PAGINA_REPORTE,
  envioFila,
  estatusVisual,
  filtrarFilas,
  nombreFila,
  ordenarFilas,
  textoFila,
} from '../reportes-presentacion';

const CONSULTA_MOVIL = '(max-width: 767.98px)';

/** Declaraciones en tiempo (obligación vigente): oficio preventivo y correo al servidor. */
@Component({
  selector: 'app-reportes-preventivos',
  standalone: true,
  imports: [
    AgGridAngular,
    BarraAcciones,
    EstadoError,
    EstadoVacio,
    Icono,
    ListaTarjetas,
    OficioPreventivoModal,
    Paginador,
    ReporteCorreosModal,
  ],
  templateUrl: './preventivos.html',
  styleUrl: './preventivos.scss',
})
export class ReportesPreventivos {
  private readonly reportes = inject(ReportesService);
  private readonly toast = inject(ToastService);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly breakpoints = inject(BreakpointObserver);

  protected readonly filas = signal<FilaReporte[]>([]);
  protected readonly cargando = signal(true);
  protected readonly yaCargo = signal(false);
  protected readonly conError = signal(false);
  protected readonly textoBusqueda = signal('');
  protected readonly orden = signal<Orden | null>(null);
  protected readonly pagina = signal(0);
  protected readonly limite = signal(TAMANOS_PAGINA_REPORTE[0]);
  protected readonly oficioFila = signal<FilaReporte | null>(null);
  protected readonly modalExcel = signal(false);
  /** Declaraciones con un correo en camino (evita doble envío). */
  protected readonly enviando = signal<ReadonlySet<number>>(new Set());
  protected readonly tamanosPagina = TAMANOS_PAGINA_REPORTE;
  protected readonly esMovil = toSignal(
    this.breakpoints.observe(CONSULTA_MOVIL).pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  protected readonly filtradas = computed(() =>
    ordenarFilas(filtrarFilas(this.filas(), this.textoBusqueda()), this.orden()),
  );
  protected readonly total = computed(() => this.filtradas().length);
  protected readonly filasPagina = computed(() => {
    const inicio = this.pagina() * this.limite();
    return this.filtradas().slice(inicio, inicio + this.limite());
  });

  protected readonly gridTheme = simcgGridTheme;
  protected readonly localeText = AG_GRID_LOCALE;
  protected readonly columnaBase = AG_GRID_COLUMNA_BASE;
  protected readonly obtenerIdFila = (p: { data: FilaReporte }) => String(p.data.id);

  // Tarjetas móviles: las mismas filas que el grid.
  protected readonly idTarjeta = (f: FilaReporte) => f.id;
  protected readonly tituloTarjeta = (f: FilaReporte) => nombreFila(f, true);
  protected readonly subtituloTarjeta = (f: FilaReporte) => textoFila(f.curp, true);
  protected readonly detalleTarjeta = (f: FilaReporte) =>
    [textoFila(f.dependencia, true), f.tipoMovimiento, envioFila(f)].filter(Boolean).join(' · ');
  protected readonly estatusTarjeta = estatusVisual;

  protected readonly acciones: AccionFila<FilaReporte>[] = [
    {
      etiqueta: 'Generar oficio',
      icono: 'documento',
      ejecutar: (fila) => this.abrirOficio(fila),
    },
    {
      etiqueta: 'Enviar correo',
      icono: 'sobre',
      visible: (fila) => !this.enviando().has(fila.id),
      ejecutar: (fila) => void this.enviarCorreo(fila),
    },
  ];

  protected readonly columnas: ColDef<FilaReporte>[] = [
    ...columnasReporte(true),
    {
      colId: 'oficio',
      headerName: 'OFICIO PREVENTIVO',
      minWidth: 170,
      flex: 1,
      sortable: false,
      cellRenderer: BotonIconoCelda,
      cellRendererParams: {
        etiqueta: 'Generar oficio',
        icono: 'documento',
        ejecutar: (fila: FilaReporte) => this.abrirOficio(fila),
      },
    },
    {
      colId: 'correo',
      headerName: 'ENVIO CORREO',
      minWidth: 160,
      flex: 1,
      sortable: false,
      cellRenderer: BotonIconoCelda,
      cellRendererParams: {
        etiqueta: 'Enviar correo',
        icono: 'sobre',
        deshabilitado: (fila: FilaReporte) => this.enviando().has(fila.id),
        ejecutar: (fila: FilaReporte) => void this.enviarCorreo(fila),
      },
    },
  ];

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.conError.set(false);
    this.reportes.preventivos().subscribe({
      next: (filas) => {
        this.filas.set(filas);
        this.cargando.set(false);
        this.yaCargo.set(true);
      },
      error: (err: unknown) => {
        this.cargando.set(false);
        this.conError.set(true);
        this.toast.errorHttp(err, 'No se pudo consultar el reporte.');
      },
    });
  }

  protected alOrdenar(evento: SortChangedEvent<FilaReporte>): void {
    this.orden.set(ordenDeGrid(evento));
    this.pagina.set(0);
  }

  protected alEscribir(evento: Event): void {
    this.textoBusqueda.set((evento.target as HTMLInputElement).value);
    this.pagina.set(0);
  }

  protected cambiarLimite(limite: number): void {
    this.limite.set(limite);
    this.pagina.set(0);
  }

  protected abrirOficio(fila: FilaReporte): void {
    this.oficioFila.set(fila);
  }

  /** Pide confirmación y envía el correo preventivo; muestra el éxito o el error del servidor. */
  protected async enviarCorreo(fila: FilaReporte): Promise<void> {
    if (this.enviando().has(fila.id)) return;
    const confirmado = await this.confirmacion.confirmar({
      titulo: 'Enviar correo',
      mensaje: `¿Enviar el correo preventivo a ${nombreFila(fila, true)}?`,
      textoConfirmar: 'Enviar',
    });
    if (!confirmado) return;

    this.marcarEnvio(fila.id, true);
    this.reportes.enviarCorreoPreventivo(fila.id).subscribe({
      next: () => {
        this.marcarEnvio(fila.id, false);
        this.toast.success('Correo enviado con éxito.');
      },
      error: (err: unknown) => {
        this.marcarEnvio(fila.id, false);
        this.toast.errorHttp(err, 'No se pudo enviar el correo.');
      },
    });
  }

  private marcarEnvio(id: number, enCurso: boolean): void {
    const siguiente = new Set(this.enviando());
    if (enCurso) siguiente.add(id);
    else siguiente.delete(id);
    this.enviando.set(siguiente);
  }
}
