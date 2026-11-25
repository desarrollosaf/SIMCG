import { Component, computed, signal, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import Swal from 'sweetalert2';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-community';
import {
  CargasService,
  EstadoNoObligado,
  FilaPrevisualizacionNoObligado,
  PrevisualizacionNoObligados,
} from '../../core/services/cargas.service';
import { ToastService } from '../../core/services/toast.service';
import { AG_GRID_LOCALE, simcgGridTheme } from '../../shared/ag-grid/ag-grid-setup';
import { EstadoCelda, EstadoVisual } from '../../shared/ag-grid/estado-celda';
import { FileUpload } from '../../shared/file-upload/file-upload';
import { descargarBlob, mensajeDeError } from '../../shared/utils/descarga';
import { ColumnaAyuda } from './carga-servidores';

const MAX_CSV_BYTES = 5 * 1024 * 1024; // Mismo límite que el backend.

const ESTADOS: Record<EstadoNoObligado, EstadoVisual> = {
  aplicar: { texto: 'Se marcará', tono: 'info' },
  ya_no_obligado: { texto: 'Ya era no obligado', tono: 'neutro' },
  error: { texto: 'Error', tono: 'error' },
};

@Component({
  selector: 'app-carga-no-obligados',
  standalone: true,
  imports: [AgGridAngular, FileUpload],
  templateUrl: './carga-no-obligados.html',
  styleUrl: './carga-no-obligados.scss',
})
export class CargaNoObligados {
  private readonly cargasService = inject(CargasService);
  private readonly toastService = inject(ToastService);

  protected readonly archivo = signal<File | null>(null);
  protected readonly vista = signal<PrevisualizacionNoObligados | null>(null);
  protected readonly cargando = signal(false);
  protected readonly soloErrores = signal(false);
  protected readonly ayudaAbierta = signal(false);

  protected readonly filasVisibles = computed(() => {
    const filas = this.vista()?.filas ?? [];
    return this.soloErrores() ? filas.filter((f) => f.estado === 'error') : filas;
  });
  protected readonly errores = computed(
    () => this.vista()?.filas.filter((f) => f.estado === 'error').length ?? 0,
  );

  protected readonly extensiones = ['.csv'];
  protected readonly maxBytes = MAX_CSV_BYTES;
  protected readonly gridTheme = simcgGridTheme;
  protected readonly localeText = AG_GRID_LOCALE;
  protected readonly columnas: ColDef<FilaPrevisualizacionNoObligado>[] = this.definirColumnas();

  protected readonly columnasAyuda: ColumnaAyuda[] = [
    { nombre: 'curp', descripcion: 'CURP del servidor público' },
    { nombre: 'rfc', descripcion: 'RFC del servidor público' },
    { nombre: 'tipo_movimiento', descripcion: 'Tipo de movimiento a marcar' },
    { nombre: 'fecha_movimiento', descripcion: 'Fecha del movimiento (dd/mm/aaaa)' },
  ];

  alternarAyuda(): void {
    this.ayudaAbierta.update((v) => !v);
  }

  alternarSoloErrores(evento: Event): void {
    this.soloErrores.set((evento.target as HTMLInputElement).checked);
  }

  /** Al cambiar el archivo se descarta la previsualización anterior. */
  alCambiarArchivo(archivo: File | null): void {
    this.archivo.set(archivo);
    this.vista.set(null);
    this.soloErrores.set(false);
  }

  descargarLayout(): void {
    this.cargasService.descargarLayoutNoObligados().subscribe({
      next: (blob) => descargarBlob(blob, 'layout-no-obligados.csv'),
      error: () => this.toastService.error('No se pudo descargar el layout.'),
    });
  }

  previsualizar(): void {
    const archivo = this.archivo();
    if (!archivo || this.cargando()) return;
    this.cargando.set(true);
    this.cargasService.previsualizarNoObligados(archivo).subscribe({
      next: (vista) => {
        this.vista.set(vista);
        this.soloErrores.set(false);
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.toastService.error(mensajeDeError(err) ?? 'No se pudo previsualizar el archivo.');
      },
    });
  }

  confirmar(): void {
    const archivo = this.archivo();
    const vista = this.vista();
    if (!archivo || !vista || vista.aplicables === 0 || this.cargando()) return;

    Swal.fire({
      title: `¿Marcar ${vista.aplicables} registros como No obligado?`,
      text:
        vista.omitidos > 0
          ? `Se omitirán ${vista.omitidos} renglones (errores o ya no obligados).`
          : 'Las declaraciones coincidentes se marcarán como No obligado, motivo OTRO.',
      icon: 'question',
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText: 'Sí, marcar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: 'var(--brand-primary)',
      cancelButtonColor: 'var(--brand-muted)',
    }).then((resultado) => {
      if (!resultado.isConfirmed) return;
      this.enviar(archivo);
    });
  }

  private enviar(archivo: File): void {
    this.cargando.set(true);
    this.cargasService.confirmarNoObligados(archivo).subscribe({
      next: (res) => {
        this.cargando.set(false);
        this.toastService.success(
          `Se marcaron ${res.actualizados} declaraciones como No obligado ` +
            `(${res.renglonesAplicados} renglones aplicados, ${res.omitidos} omitidos).`,
        );
        this.alCambiarArchivo(null);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        const mensaje =
          mensajeDeError(err) ??
          (err.status === 409
            ? 'Hubo cambios desde la previsualización. Vuelve a previsualizar el archivo.'
            : 'No se pudo aplicar el archivo.');
        this.toastService.error(mensaje);
      },
    });
  }

  private definirColumnas(): ColDef<FilaPrevisualizacionNoObligado>[] {
    return [
      { field: 'renglon', headerName: 'Renglón', width: 110 },
      { field: 'curp', headerName: 'CURP', minWidth: 190, flex: 1 },
      { field: 'nombre', headerName: 'Nombre', minWidth: 200, flex: 1.3 },
      { field: 'tipoMovimiento', headerName: 'Movimiento', minWidth: 150, flex: 1 },
      { field: 'fechaMovimiento', headerName: 'Fecha', width: 130 },
      {
        headerName: 'Estado',
        width: 190,
        cellRenderer: EstadoCelda,
        cellRendererParams: {
          estado: (fila: FilaPrevisualizacionNoObligado): EstadoVisual => ESTADOS[fila.estado],
        },
      },
      {
        headerName: 'Errores',
        minWidth: 240,
        flex: 1.6,
        valueGetter: (p) => p.data?.errores.join('; ') ?? '',
        tooltipValueGetter: (p) => p.value as string,
      },
    ];
  }
}
