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
import { EstadoError, EstadoVacio } from '../../../shared/estado/estado';
import { Icono } from '../../../shared/icono/icono';
import { Paginador } from '../../../shared/paginador/paginador';
import { descargarBlob, nombreDeContentDisposition } from '../../../shared/utils/descarga';
import { OficioOmisoModal } from '../modales/oficio-omiso-modal';
import { columnasReporte, ordenDeGrid } from '../reportes-columnas';
import {
  Orden,
  TAMANOS_PAGINA_REPORTE,
  envioFila,
  estatusVisual,
  filtrarFilas,
  nombreFila,
  ordenarFilas,
} from '../reportes-presentacion';

const CONSULTA_MOVIL = '(max-width: 767.98px)';

/** Detección de omisos y envíos extemporáneos por rango de fechas, con oficio de remisión. */
@Component({
  selector: 'app-reportes-omisos',
  standalone: true,
  imports: [
    AgGridAngular,
    BarraAcciones,
    EstadoError,
    EstadoVacio,
    Icono,
    ListaTarjetas,
    OficioOmisoModal,
    Paginador,
  ],
  templateUrl: './omisos.html',
  styleUrl: './omisos.scss',
})
export class ReportesOmisos {
  private readonly reportes = inject(ReportesService);
  private readonly toast = inject(ToastService);
  private readonly breakpoints = inject(BreakpointObserver);

  protected readonly fechaInicio = signal('');
  protected readonly fechaFin = signal('');
  protected readonly filas = signal<FilaReporte[]>([]);
  protected readonly cargando = signal(false);
  protected readonly exportando = signal(false);
  protected readonly yaBusco = signal(false);
  protected readonly conError = signal(false);
  protected readonly textoBusqueda = signal('');
  protected readonly orden = signal<Orden | null>(null);
  protected readonly pagina = signal(0);
  protected readonly limite = signal(TAMANOS_PAGINA_REPORTE[0]);
  protected readonly oficioFila = signal<FilaReporte | null>(null);
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
  protected readonly tituloTarjeta = (f: FilaReporte) => nombreFila(f);
  protected readonly subtituloTarjeta = (f: FilaReporte) => f.curp;
  protected readonly detalleTarjeta = (f: FilaReporte) =>
    [f.dependencia, f.tipoMovimiento, envioFila(f)].filter(Boolean).join(' · ');
  protected readonly estatusTarjeta = estatusVisual;

  protected readonly acciones: AccionFila<FilaReporte>[] = [
    {
      etiqueta: 'Generar oficio',
      icono: 'documento',
      ejecutar: (fila) => this.abrirOficio(fila),
    },
  ];

  protected readonly columnas: ColDef<FilaReporte>[] = [
    ...columnasReporte(false),
    {
      colId: 'oficio',
      headerName: 'OFICIO DE REMISIÓN (OMISO)',
      minWidth: 190,
      flex: 1.1,
      sortable: false,
      cellRenderer: BotonIconoCelda,
      cellRendererParams: {
        etiqueta: 'Generar oficio',
        icono: 'documento',
        ejecutar: (fila: FilaReporte) => this.abrirOficio(fila),
      },
    },
  ];

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

  protected alCambiarFecha(campo: 'inicio' | 'fin', evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    (campo === 'inicio' ? this.fechaInicio : this.fechaFin).set(valor);
  }

  protected buscar(): void {
    if (!this.fechasCompletas()) return;
    this.cargando.set(true);
    this.conError.set(false);
    this.reportes.omisos(this.fechaInicio(), this.fechaFin()).subscribe({
      next: (filas) => {
        this.filas.set(filas);
        this.textoBusqueda.set('');
        this.pagina.set(0);
        this.cargando.set(false);
        this.yaBusco.set(true);
      },
      error: (err: unknown) => {
        this.cargando.set(false);
        this.conError.set(true);
        this.toast.errorHttp(err, 'No se pudo consultar el reporte.');
      },
    });
  }

  protected exportar(): void {
    if (!this.fechasCompletas() || this.exportando()) return;
    this.exportando.set(true);
    this.reportes.excelCorreos('REMISION', this.fechaInicio(), this.fechaFin()).subscribe({
      next: (respuesta) => {
        this.exportando.set(false);
        if (respuesta.body) {
          descargarBlob(respuesta.body, nombreDeContentDisposition(respuesta) ?? 'correo.xlsx');
        }
      },
      error: (err: unknown) => {
        this.exportando.set(false);
        this.toast.errorHttp(err, 'No se pudo exportar el reporte.');
      },
    });
  }

  protected abrirOficio(fila: FilaReporte): void {
    this.oficioFila.set(fila);
  }

  private fechasCompletas(): boolean {
    if (this.fechaInicio() && this.fechaFin()) return true;
    this.toast.error('Favor de llenar los campos de fecha');
    return false;
  }
}
