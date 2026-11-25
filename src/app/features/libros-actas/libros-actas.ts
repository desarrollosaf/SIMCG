import { Component, OnDestroy, computed, signal, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import Swal from 'sweetalert2';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-community';
import {
  ActaCierre,
  ArchivoActa,
  DeclaracionLibro,
  LibrosService,
  ResumenLibros,
  TipoLibro,
} from '../../core/services/libros.service';
import { ToastService } from '../../core/services/toast.service';
import { AG_GRID_LOCALE, simcgGridTheme } from '../../shared/ag-grid/ag-grid-setup';
import { FileUpload } from '../../shared/file-upload/file-upload';
import {
  descargarBlob,
  formatearFecha,
  mensajeDeError,
  nombreDeContentDisposition,
} from '../../shared/utils/descarga';

const ESPERA_BUSQUEDA_MS = 350;
const TAMANOS_PAGINA = [10, 20, 50];
const MAX_ACTA_BYTES = 15 * 1024 * 1024;

export interface PestanaLibro {
  clave: TipoLibro;
  etiqueta: string;
}

export const PESTANAS: readonly PestanaLibro[] = [
  { clave: 'inicial', etiqueta: 'Inicial' },
  { clave: 'modificacion', etiqueta: 'Modificación' },
  { clave: 'conclusion', etiqueta: 'Conclusión' },
];

@Component({
  selector: 'app-libros-actas',
  standalone: true,
  imports: [AgGridAngular, FileUpload],
  templateUrl: './libros-actas.html',
  styleUrl: './libros-actas.scss',
})
export class LibrosActas implements OnDestroy {
  private readonly librosService = inject(LibrosService);
  private readonly toastService = inject(ToastService);

  protected readonly pestanas = PESTANAS;
  protected readonly tamanosPagina = TAMANOS_PAGINA;
  protected readonly extensionesActa = ['.pdf', '.tif', '.tiff'];
  protected readonly maxBytesActa = MAX_ACTA_BYTES;

  protected readonly anios = signal<number[]>([]);
  protected readonly anio = signal<number | null>(null);
  protected readonly tipo = signal<TipoLibro>('inicial');
  protected readonly resumen = signal<ResumenLibros | null>(null);
  protected readonly filas = signal<DeclaracionLibro[]>([]);
  protected readonly total = signal(0);
  protected readonly cargando = signal(true);
  protected readonly pagina = signal(0);
  protected readonly limite = signal(TAMANOS_PAGINA[0]);
  protected readonly buscar = signal('');

  protected readonly panelAbierto = signal(false);
  protected readonly actas = signal<ActaCierre[]>([]);
  protected readonly cargandoActas = signal(false);
  protected readonly guardando = signal<TipoLibro | null>(null);
  protected readonly archivosActa = signal<Partial<Record<TipoLibro, File | null>>>({});

  protected readonly resumenActual = computed(() => this.resumen()?.[this.tipo()] ?? null);
  protected readonly paginas = computed(() => Math.max(1, Math.ceil(this.total() / this.limite())));
  protected readonly desde = computed(() =>
    this.total() === 0 ? 0 : this.pagina() * this.limite() + 1,
  );
  protected readonly hasta = computed(() =>
    Math.min(this.total(), (this.pagina() + 1) * this.limite()),
  );

  protected readonly gridTheme = simcgGridTheme;
  protected readonly localeText = AG_GRID_LOCALE;
  protected readonly columnas: ColDef<DeclaracionLibro>[] = [
    { field: 'nombre', headerName: 'Nombre', minWidth: 220, flex: 1.5, sortable: false },
    { field: 'cargo', headerName: 'Cargo', minWidth: 180, flex: 1.2, sortable: false },
    { field: 'curp', headerName: 'CURP', minWidth: 180, flex: 1.1, sortable: false },
    { field: 'dependencia', headerName: 'Dependencia', minWidth: 180, flex: 1.2, sortable: false },
    { field: 'direccion', headerName: 'Dirección', minWidth: 180, flex: 1.2, sortable: false },
    { field: 'tipoMovimiento', headerName: 'Movimiento', minWidth: 150, flex: 1, sortable: false },
    {
      field: 'fechaEnvio',
      headerName: 'Fecha de envío',
      width: 150,
      sortable: false,
      valueFormatter: (p) => formatearFecha(p.value as string | null),
    },
  ];

  private temporizador: ReturnType<typeof setTimeout> | undefined;
  private peticion = 0;

  constructor() {
    this.cargarAnios();
  }

  ngOnDestroy(): void {
    clearTimeout(this.temporizador);
  }

  cambiarAnio(evento: Event): void {
    const anio = Number((evento.target as HTMLSelectElement).value);
    this.anio.set(anio);
    this.pagina.set(0);
    this.cargarResumen();
    this.cargarDeclaraciones();
    if (this.panelAbierto()) this.cargarActas();
  }

  seleccionarTipo(tipo: TipoLibro): void {
    if (tipo === this.tipo()) return;
    this.tipo.set(tipo);
    this.pagina.set(0);
    this.cargarDeclaraciones();
  }

  /** Navegación con flechas entre pestañas (patrón WAI-ARIA tabs). */
  alTeclaPestana(evento: KeyboardEvent, indice: number): void {
    const ultimo = PESTANAS.length - 1;
    let destino: number;
    switch (evento.key) {
      case 'ArrowRight':
        destino = indice === ultimo ? 0 : indice + 1;
        break;
      case 'ArrowLeft':
        destino = indice === 0 ? ultimo : indice - 1;
        break;
      case 'Home':
        destino = 0;
        break;
      case 'End':
        destino = ultimo;
        break;
      default:
        return;
    }
    evento.preventDefault();
    this.seleccionarTipo(PESTANAS[destino].clave);
    const pestanas = (
      evento.currentTarget as HTMLElement
    ).parentElement?.querySelectorAll<HTMLElement>('[role="tab"]');
    pestanas?.[destino]?.focus();
  }

  alEscribir(evento: Event): void {
    this.buscar.set((evento.target as HTMLInputElement).value);
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => {
      this.pagina.set(0);
      this.cargarDeclaraciones();
    }, ESPERA_BUSQUEDA_MS);
  }

  limpiarBusqueda(): void {
    this.buscar.set('');
    this.pagina.set(0);
    this.cargarDeclaraciones();
  }

  cambiarLimite(evento: Event): void {
    this.limite.set(Number((evento.target as HTMLSelectElement).value));
    this.pagina.set(0);
    this.cargarDeclaraciones();
  }

  irAPagina(pagina: number): void {
    if (pagina < 0 || pagina >= this.paginas()) return;
    this.pagina.set(pagina);
    this.cargarDeclaraciones();
  }

  // ---- Actas de cierre ----

  abrirPanel(): void {
    this.panelAbierto.set(true);
    this.archivosActa.set({});
    this.cargarActas();
  }

  cerrarPanel(): void {
    this.panelAbierto.set(false);
  }

  elegirArchivoActa(tipo: TipoLibro, archivo: File | null): void {
    this.archivosActa.update((actual) => ({ ...actual, [tipo]: archivo }));
  }

  descargar(acta: ActaCierre, archivo: ArchivoActa): void {
    if (acta.id === null) return;
    this.librosService.descargarArchivo(acta.id, archivo).subscribe({
      next: (respuesta) => {
        if (!respuesta.body) return;
        const alterno = archivo === 'acta' ? (acta.nombreActa ?? 'acta.pdf') : 'soporte.xlsx';
        descargarBlob(respuesta.body, nombreDeContentDisposition(respuesta) ?? alterno);
      },
      error: () => this.toastService.error('No se pudo descargar el archivo.'),
    });
  }

  async guardarActa(acta: ActaCierre): Promise<void> {
    const archivo = this.archivosActa()[acta.tipo];
    const anio = this.anio();
    if (!archivo || anio === null || this.guardando()) return;

    if (acta.tieneActa) {
      const resultado = await Swal.fire({
        title: '¿Reemplazar el acta existente?',
        text: `Ya hay un acta de ${this.etiquetaTipo(acta.tipo)} para ${anio}. Se sustituirá por ${archivo.name}.`,
        icon: 'warning',
        showCancelButton: true,
        reverseButtons: true,
        confirmButtonText: 'Sí, reemplazar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: 'var(--brand-primary)',
        cancelButtonColor: 'var(--brand-muted)',
      });
      if (!resultado.isConfirmed) return;
    }

    this.guardando.set(acta.tipo);
    this.librosService.guardarActa(archivo, anio, acta.tipo).subscribe({
      next: (actualizada) => {
        this.guardando.set(null);
        this.actas.update((lista) =>
          lista.map((a) => (a.tipo === actualizada.tipo ? actualizada : a)),
        );
        this.elegirArchivoActa(acta.tipo, null);
        this.toastService.success('Acta de cierre guardada.');
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(null);
        this.toastService.error(mensajeDeError(err) ?? 'No se pudo guardar el acta.');
      },
    });
  }

  etiquetaTipo(tipo: TipoLibro): string {
    return PESTANAS.find((p) => p.clave === tipo)?.etiqueta ?? tipo;
  }

  formatearFecha(valor: string | null): string {
    return formatearFecha(valor);
  }

  // ---- Carga de datos ----

  private cargarAnios(): void {
    this.librosService.anios().subscribe({
      next: (anios) => {
        this.anios.set(anios);
        const actual = new Date().getFullYear();
        const elegido = anios.includes(actual) ? actual : (anios[0] ?? null);
        this.anio.set(elegido);
        if (elegido === null) {
          this.cargando.set(false);
          return;
        }
        this.cargarResumen();
        this.cargarDeclaraciones();
      },
      error: () => {
        this.cargando.set(false);
        this.toastService.error('No se pudieron cargar los años disponibles.');
      },
    });
  }

  private cargarResumen(): void {
    const anio = this.anio();
    if (anio === null) return;
    this.librosService.resumen(anio).subscribe({
      next: (resumen) => this.resumen.set(resumen),
      error: () => this.toastService.error('No se pudo cargar el resumen del año.'),
    });
  }

  private cargarDeclaraciones(): void {
    const anio = this.anio();
    if (anio === null) return;
    const id = ++this.peticion;
    this.cargando.set(true);
    this.librosService
      .declaraciones({
        anio,
        tipo: this.tipo(),
        buscar: this.buscar().trim(),
        inicio: this.pagina() * this.limite(),
        limite: this.limite(),
      })
      .subscribe({
        next: (pagina) => {
          if (id !== this.peticion) return;
          this.filas.set(pagina.filas);
          this.total.set(pagina.total);
          this.cargando.set(false);
        },
        error: () => {
          if (id !== this.peticion) return;
          this.cargando.set(false);
          this.toastService.error('No se pudieron cargar las declaraciones.');
        },
      });
  }

  private cargarActas(): void {
    const anio = this.anio();
    if (anio === null) return;
    this.cargandoActas.set(true);
    this.librosService.actas(anio).subscribe({
      next: (actas) => {
        this.actas.set(actas);
        this.cargandoActas.set(false);
      },
      error: () => {
        this.cargandoActas.set(false);
        this.toastService.error('No se pudieron cargar las actas de cierre.');
      },
    });
  }
}
