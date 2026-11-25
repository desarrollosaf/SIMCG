import { Component, OnDestroy, computed, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import Swal from 'sweetalert2';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, SortChangedEvent } from 'ag-grid-community';
import { puedeEditarServidores } from '../../../core/access/acceso-por-rol';
import { AuthService } from '../../../core/services/auth.service';
import {
  ServidorFila,
  ServidoresService,
  ConsultaServidores,
} from '../../../core/services/servidores.service';
import { ToastService } from '../../../core/services/toast.service';
import { AG_GRID_LOCALE, simcgGridTheme } from '../../../shared/ag-grid/ag-grid-setup';
import { BotonCeldaComponent } from '../../../shared/ag-grid/boton-celda';

const ESPERA_BUSQUEDA_MS = 350;
const TAMANOS_PAGINA = [10, 20, 50];
// El orden lo hace el servidor; el grid no debe reordenar la página.
const SIN_ORDEN_LOCAL = () => 0;

@Component({
  selector: 'app-servidores-lista',
  standalone: true,
  imports: [AgGridAngular],
  templateUrl: './servidores-lista.html',
  styleUrl: './servidores-lista.scss',
})
export class ServidoresLista implements OnDestroy {
  private readonly servidoresService = inject(ServidoresService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly filas = signal<ServidorFila[]>([]);
  protected readonly total = signal(0);
  protected readonly cargando = signal(true);
  protected readonly pagina = signal(0);
  protected readonly limite = signal(TAMANOS_PAGINA[0]);
  protected readonly buscar = signal('');
  protected readonly tamanosPagina = TAMANOS_PAGINA;

  protected readonly puedeEditar = computed(() =>
    puedeEditarServidores(this.authService.currentUser()?.roles),
  );
  protected readonly paginas = computed(() => Math.max(1, Math.ceil(this.total() / this.limite())));
  protected readonly desde = computed(() =>
    this.total() === 0 ? 0 : this.pagina() * this.limite() + 1,
  );
  protected readonly hasta = computed(() =>
    Math.min(this.total(), (this.pagina() + 1) * this.limite()),
  );

  protected readonly gridTheme = simcgGridTheme;
  protected readonly localeText = AG_GRID_LOCALE;
  protected readonly columnas: ColDef<ServidorFila>[] = this.definirColumnas();

  private orden: Pick<ConsultaServidores, 'ordenar' | 'direccion'> = {
    ordenar: 'nombre',
    direccion: 'asc',
  };
  private temporizador: ReturnType<typeof setTimeout> | undefined;
  private peticion = 0;

  constructor() {
    this.cargar();
  }

  ngOnDestroy(): void {
    clearTimeout(this.temporizador);
  }

  nuevo(): void {
    void this.router.navigate(['/servidores', 'nuevo']);
  }

  alEscribir(evento: Event): void {
    const texto = (evento.target as HTMLInputElement).value;
    this.buscar.set(texto);
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => {
      this.pagina.set(0);
      this.cargar();
    }, ESPERA_BUSQUEDA_MS);
  }

  limpiarBusqueda(): void {
    this.buscar.set('');
    this.pagina.set(0);
    this.cargar();
  }

  cambiarLimite(evento: Event): void {
    this.limite.set(Number((evento.target as HTMLSelectElement).value));
    this.pagina.set(0);
    this.cargar();
  }

  irAPagina(pagina: number): void {
    if (pagina < 0 || pagina >= this.paginas()) return;
    this.pagina.set(pagina);
    this.cargar();
  }

  alOrdenar(evento: SortChangedEvent<ServidorFila>): void {
    const columna = evento.api.getColumnState().find((c) => c.sort);
    this.orden = {
      ordenar: columna?.colId === 'curp' ? 'curp' : 'nombre',
      direccion: columna?.sort === 'desc' ? 'desc' : 'asc',
    };
    this.pagina.set(0);
    this.cargar();
  }

  private definirColumnas(): ColDef<ServidorFila>[] {
    return [
      {
        colId: 'nombre',
        field: 'nombre',
        headerName: 'Nombre',
        minWidth: 220,
        flex: 1.6,
        sortable: true,
        comparator: SIN_ORDEN_LOCAL,
      },
      {
        colId: 'curp',
        field: 'curp',
        headerName: 'CURP',
        minWidth: 180,
        flex: 1.1,
        sortable: true,
        comparator: SIN_ORDEN_LOCAL,
      },
      {
        field: 'dependencia',
        headerName: 'Dependencia',
        minWidth: 200,
        flex: 1.3,
        sortable: false,
      },
      { field: 'direccion', headerName: 'Dirección', minWidth: 200, flex: 1.3, sortable: false },
      this.columnaAccion('Movimientos', 'lista', 150, (fila) => this.verMovimientos(fila)),
      this.columnaAccion(
        'Editar',
        'editar',
        110,
        (fila) => this.editar(fila),
        () => this.puedeEditar(),
      ),
      this.columnaAccion(
        'Baja',
        'basura',
        100,
        (fila) => this.baja(fila),
        () => this.puedeEditar(),
      ),
    ];
  }

  private columnaAccion(
    label: string,
    icono: 'lista' | 'editar' | 'basura',
    width: number,
    onClick: (fila: ServidorFila) => void,
    visible: () => boolean = () => true,
  ): ColDef<ServidorFila> {
    return {
      headerName: '',
      width,
      pinned: 'right',
      sortable: false,
      filter: false,
      resizable: false,
      suppressMovable: true,
      cellRenderer: BotonCeldaComponent,
      cellRendererParams: {
        label,
        icono,
        onClick: (data: ServidorFila) => onClick(data),
        visible: () => visible(),
      },
    };
  }

  private verMovimientos(fila: ServidorFila): void {
    void this.router.navigate(['/servidores', fila.id, 'movimientos']);
  }

  private editar(fila: ServidorFila): void {
    void this.router.navigate(['/servidores', fila.id, 'editar']);
  }

  private baja(fila: ServidorFila): void {
    Swal.fire({
      title: '¿Dar de baja este servidor público?',
      text: `${fila.nombre}. Captura el motivo de la baja.`,
      icon: 'warning',
      input: 'textarea',
      inputPlaceholder: 'Motivo de la baja',
      inputAttributes: { maxlength: '500' },
      inputValidator: (valor) =>
        valor.trim().length < 5 ? 'El motivo debe tener al menos 5 caracteres' : null,
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText: 'Sí, dar de baja',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: 'var(--brand-danger)',
      cancelButtonColor: 'var(--brand-muted)',
    }).then((resultado) => {
      if (!resultado.isConfirmed) return;

      this.servidoresService.baja(fila.id, String(resultado.value).trim()).subscribe({
        next: () => {
          this.toastService.success('Servidor público dado de baja.');
          this.cargar();
        },
        error: (err: HttpErrorResponse) =>
          this.toastService.error(this.mensaje(err) ?? 'No se pudo dar de baja al servidor.'),
      });
    });
  }

  private mensaje(err: HttpErrorResponse): string | null {
    const mensaje = err.error?.message;
    if (Array.isArray(mensaje)) return mensaje.join(' ');
    return typeof mensaje === 'string' ? mensaje : null;
  }

  private cargar(): void {
    const id = ++this.peticion;
    this.cargando.set(true);
    this.servidoresService
      .listar({
        inicio: this.pagina() * this.limite(),
        limite: this.limite(),
        buscar: this.buscar().trim(),
        ...this.orden,
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
          this.toastService.error('No se pudieron cargar los servidores públicos.');
        },
      });
  }
}
