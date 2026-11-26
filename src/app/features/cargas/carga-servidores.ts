import { Component, computed, signal, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import Swal from 'sweetalert2';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-community';
import {
  CargasService,
  FilaPrevisualizacionServidor,
  PrevisualizacionServidores,
} from '../../core/services/cargas.service';
import { ToastService } from '../../core/services/toast.service';
import {
  AG_GRID_COLUMNA_BASE,
  AG_GRID_LOCALE,
  simcgGridTheme,
} from '../../shared/ag-grid/ag-grid-setup';
import { EstadoCelda, EstadoVisual } from '../../shared/ag-grid/estado-celda';
import { Ayuda } from '../../shared/ayuda/ayuda';
import { FileUpload } from '../../shared/file-upload/file-upload';
import { descargarBlob, mensajeDeError } from '../../shared/utils/descarga';

export interface ColumnaAyuda {
  nombre: string;
  descripcion: string;
}

const MAX_CSV_BYTES = 5 * 1024 * 1024; // Mismo límite que el backend.

@Component({
  selector: 'app-carga-servidores',
  standalone: true,
  imports: [AgGridAngular, FileUpload, Ayuda],
  templateUrl: './carga-servidores.html',
  styleUrl: './carga-servidores.scss',
})
export class CargaServidores {
  private readonly cargasService = inject(CargasService);
  private readonly toastService = inject(ToastService);

  protected readonly archivo = signal<File | null>(null);
  protected readonly vista = signal<PrevisualizacionServidores | null>(null);
  protected readonly cargando = signal(false);
  protected readonly soloErrores = signal(false);

  protected readonly filasVisibles = computed(() => {
    const filas = this.vista()?.filas ?? [];
    return this.soloErrores() ? filas.filter((f) => f.errores.length > 0) : filas;
  });

  protected readonly extensiones = ['.csv'];
  protected readonly maxBytes = MAX_CSV_BYTES;
  protected readonly gridTheme = simcgGridTheme;
  protected readonly localeText = AG_GRID_LOCALE;
  protected readonly columnaBase = AG_GRID_COLUMNA_BASE;
  protected readonly columnas: ColDef<FilaPrevisualizacionServidor>[] = this.definirColumnas();

  protected readonly columnasAyuda: ColumnaAyuda[] = [
    { nombre: 'nombre', descripcion: 'Nombre(s)' },
    { nombre: 'primer_apellido', descripcion: 'Primer apellido' },
    { nombre: 'segundo_apellido', descripcion: 'Segundo apellido (opcional)' },
    { nombre: 'curp', descripcion: 'CURP de 18 caracteres' },
    { nombre: 'rfc', descripcion: 'RFC de 10 caracteres, sin homoclave' },
    { nombre: 'homoclave', descripcion: 'Homoclave del RFC (también se acepta homcve)' },
    {
      nombre: 'fecha_inicio',
      descripcion: 'Fecha de inicio en el cargo, dd/mm/aaaa (también fecha_de_inicio)',
    },
    { nombre: 'cargo', descripcion: 'Nombre del cargo' },
    { nombre: 'nivel_cargo', descripcion: 'Nivel del cargo (también se acepta nivel_empleo)' },
    { nombre: 'cve_issemym', descripcion: 'Clave ISSEMYM de 7 dígitos (opcional)' },
    { nombre: 'dependencia_id', descripcion: 'Id de la dependencia' },
    { nombre: 'direccion_id', descripcion: 'Id de la dirección (opcional)' },
    { nombre: 'departamento_id', descripcion: 'Id del departamento (opcional)' },
    { nombre: 'honorarios', descripcion: '1 = Sí, 2 = No' },
    { nombre: 'tipo_movimiento', descripcion: 'Id del tipo de movimiento del catálogo' },
    {
      nombre: 'fecha_movimiento',
      descripcion: 'Fecha del movimiento, dd/mm/aaaa (también fecha_de_movimiento)',
    },
    {
      nombre: 'obligado',
      descripcion:
        'Opcional. 1 = no obligado (motivo «Otro»); vacío o cualquier otro valor = obligado a declarar',
    },
  ];

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
    this.cargasService.descargarLayoutServidores().subscribe({
      next: (blob) => descargarBlob(blob, 'layout-servidores.csv'),
      error: () => this.toastService.error('No se pudo descargar el layout.'),
    });
  }

  /**
   * «Importar registros»: valida el archivo y, si todos los renglones son válidos, los importa;
   * si hay errores los muestra para corregirlos o importar solo los válidos.
   */
  importar(): void {
    const archivo = this.archivo();
    if (!archivo || this.cargando()) return;
    this.cargando.set(true);
    this.cargasService.previsualizarServidores(archivo).subscribe({
      next: (vista) => {
        this.vista.set(vista);
        this.soloErrores.set(false);
        this.cargando.set(false);
        if (vista.total > 0 && vista.conErrores === 0) this.enviar(archivo);
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
    if (!archivo || !vista || vista.validas === 0 || this.cargando()) return;

    const omitidos = vista.conErrores;
    Swal.fire({
      title: `¿Cargar ${vista.validas} registros válidos?`,
      text:
        omitidos > 0
          ? `Se omitirán ${omitidos} registros con errores.`
          : 'Todos los registros son válidos.',
      icon: 'question',
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText: 'Sí, cargar',
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
    this.cargasService.confirmarServidores(archivo).subscribe({
      next: (res) => {
        this.cargando.set(false);
        this.toastService.success(
          `Se cargaron ${res.insertados} servidores (${res.omitidos} omitidos).`,
        );
        this.alCambiarArchivo(null);
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        const mensaje =
          mensajeDeError(err) ??
          (err.status === 409
            ? 'Hubo cambios desde la previsualización. Vuelve a previsualizar el archivo.'
            : 'No se pudo cargar el archivo.');
        this.toastService.error(mensaje);
      },
    });
  }

  private definirColumnas(): ColDef<FilaPrevisualizacionServidor>[] {
    return [
      { field: 'renglon', headerName: 'Renglón', width: 110 },
      { field: 'curp', headerName: 'CURP', minWidth: 190, flex: 1 },
      { field: 'nombre', headerName: 'Nombre', minWidth: 220, flex: 1.4 },
      {
        headerName: 'Estado',
        width: 140,
        cellRenderer: EstadoCelda,
        cellRendererParams: {
          estado: (fila: FilaPrevisualizacionServidor): EstadoVisual =>
            fila.errores.length
              ? { texto: 'Con errores', tono: 'error' }
              : { texto: 'Válido', tono: 'ok' },
        },
      },
      {
        headerName: 'Errores',
        minWidth: 260,
        flex: 2,
        valueGetter: (p) => p.data?.errores.join('; ') ?? '',
        tooltipValueGetter: (p) => p.value as string,
      },
    ];
  }
}
