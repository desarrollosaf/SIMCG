import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import Swal from 'sweetalert2';
import { AgGridAngular } from 'ag-grid-angular';
import { CellClassParams, ColDef } from 'ag-grid-community';
import {
  puedeEditarServidores,
  puedeEliminarMovimientos,
} from '../../../core/access/acceso-por-rol';
import { AuthService } from '../../../core/services/auth.service';
import {
  CatalogosService,
  MotivoNoObligado,
  TipoMovimiento,
} from '../../../core/services/catalogos.service';
import {
  Movimiento,
  ServidorDetalle,
  ServidoresService,
} from '../../../core/services/servidores.service';
import { ToastService } from '../../../core/services/toast.service';
import { AG_GRID_LOCALE, simcgGridTheme } from '../../../shared/ag-grid/ag-grid-setup';
import { BotonCeldaComponent } from '../../../shared/ag-grid/boton-celda';

const SIN_OFICIO = 'NO HAY OFICIO';
const SIN_ENVIO = 'SIN ENVIO';

// Colores del estatus (los mismos textos que calcula el backend).
function claseEstatus(p: CellClassParams<Movimiento, string>): string {
  const estatus = p.value ?? '';
  if (estatus === 'OMISO' || estatus === 'ENVIO EXTEMPORANEO') return 'estatus estatus--malo';
  if (estatus.startsWith('NO OBLIGADO')) return 'estatus estatus--neutro';
  return 'estatus estatus--bueno';
}

@Component({
  selector: 'app-servidor-movimientos',
  standalone: true,
  imports: [ReactiveFormsModule, AgGridAngular],
  templateUrl: './servidor-movimientos.html',
  styleUrl: './servidor-movimientos.scss',
})
export class ServidorMovimientos implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly catalogos = inject(CatalogosService);
  private readonly servidoresService = inject(ServidoresService);
  private readonly toastService = inject(ToastService);

  protected servidorId = 0;
  protected readonly servidor = signal<ServidorDetalle | null>(null);
  protected readonly movimientos = signal<Movimiento[]>([]);
  protected readonly permitidos = signal<TipoMovimiento[]>([]);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);

  protected readonly puedeEditar = computed(() =>
    puedeEditarServidores(this.authService.currentUser()?.roles),
  );
  protected readonly puedeEliminar = computed(() =>
    puedeEliminarMovimientos(this.authService.currentUser()?.roles),
  );
  protected readonly nombreServidor = computed(() => {
    const s = this.servidor();
    return s ? [s.nombre, s.primerApellido, s.segundoApellido].filter(Boolean).join(' ') : '';
  });

  protected readonly form;

  protected readonly gridTheme = simcgGridTheme;
  protected readonly localeText = AG_GRID_LOCALE;
  protected readonly columnas: ColDef<Movimiento>[] = [
    { field: 'tipo', headerName: 'Movimiento', minWidth: 170, flex: 1.2 },
    { field: 'fechaDeclaracion', headerName: 'Fecha', minWidth: 120, flex: 0.8 },
    { field: 'estado', headerName: 'Estado', minWidth: 170, flex: 1.2 },
    {
      field: 'estatus',
      headerName: 'Estatus',
      minWidth: 190,
      flex: 1.2,
      cellClass: claseEstatus,
    },
    {
      field: 'oficioPreventivo',
      headerName: 'Oficio preventivo',
      minWidth: 170,
      flex: 1.1,
      valueFormatter: (p) => p.value ?? SIN_OFICIO,
    },
    {
      field: 'oficioRemision',
      headerName: 'Oficio de remisión',
      minWidth: 170,
      flex: 1.1,
      valueFormatter: (p) => p.value ?? SIN_OFICIO,
    },
    {
      field: 'fechaEnvio',
      headerName: 'Fecha de envío',
      minWidth: 140,
      flex: 0.9,
      valueFormatter: (p) => p.value ?? SIN_ENVIO,
    },
    {
      headerName: '',
      width: 120,
      pinned: 'right',
      sortable: false,
      filter: false,
      resizable: false,
      cellRenderer: BotonCeldaComponent,
      cellRendererParams: {
        label: 'Obligado',
        icono: 'editar',
        onClick: (m: Movimiento) => this.editarObligado(m),
        visible: () => this.puedeEditar(),
      },
    },
    {
      headerName: '',
      width: 115,
      pinned: 'right',
      sortable: false,
      filter: false,
      resizable: false,
      cellRenderer: BotonCeldaComponent,
      cellRendererParams: {
        label: 'Eliminar',
        icono: 'basura',
        onClick: (m: Movimiento) => this.eliminar(m),
        visible: () => this.puedeEliminar(),
      },
    },
  ];

  constructor() {
    this.form = this.fb.group({
      tipoMovimientoId: [null as number | null, [Validators.required]],
    });
  }

  ngOnInit(): void {
    this.servidorId = Number(this.route.snapshot.paramMap.get('id'));
    this.servidoresService.detalle(this.servidorId).subscribe({
      next: (s) => this.servidor.set(s),
      error: (err: HttpErrorResponse) => {
        this.toastService.error(this.mensaje(err) ?? 'No se pudo cargar el servidor público.');
        void this.router.navigate(['/servidores']);
      },
    });
    this.cargar();
  }

  volver(): void {
    void this.router.navigate(['/servidores']);
  }

  guardar(): void {
    if (this.form.invalid || this.guardando()) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    this.servidoresService
      .crearMovimiento(this.servidorId, Number(this.form.controls.tipoMovimientoId.value))
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.toastService.success('Movimiento registrado.');
          this.form.reset({ tipoMovimientoId: null });
          this.cargar();
        },
        error: (err: HttpErrorResponse) => {
          this.guardando.set(false);
          this.toastService.error(this.mensaje(err) ?? 'No se pudo registrar el movimiento.');
          this.cargar();
        },
      });
  }

  private editarObligado(movimiento: Movimiento): void {
    Swal.fire({
      title: 'Obligado a declarar',
      text: `${movimiento.tipo ?? 'Movimiento'} del ${movimiento.fechaDeclaracion}`,
      input: 'select',
      inputOptions: { si: 'OBLIGADO', no: 'NO OBLIGADO' },
      inputValue: movimiento.obligado ? 'si' : 'no',
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: 'var(--brand-primary)',
      cancelButtonColor: 'var(--brand-muted)',
    }).then((resultado) => {
      if (!resultado.isConfirmed) return;

      if (resultado.value === 'si') {
        this.guardarObligado(movimiento, true);
        return;
      }
      this.catalogos.motivosNoObligado().subscribe({
        next: (motivos) => this.pedirMotivo(movimiento, motivos),
        error: () => this.toastService.error('No se pudieron cargar los motivos.'),
      });
    });
  }

  private pedirMotivo(movimiento: Movimiento, motivos: MotivoNoObligado[]): void {
    const opciones = Object.fromEntries(motivos.map((m) => [String(m.id), m.causa]));

    Swal.fire({
      title: 'Motivo de no obligado',
      input: 'select',
      inputOptions: opciones,
      inputPlaceholder: 'Selecciona un motivo',
      inputValue: movimiento.motivoNoObligadoId ? String(movimiento.motivoNoObligadoId) : '',
      inputValidator: (valor) => (valor ? null : 'Selecciona un motivo'),
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: 'var(--brand-primary)',
      cancelButtonColor: 'var(--brand-muted)',
    }).then((resultado) => {
      if (!resultado.isConfirmed) return;
      this.guardarObligado(movimiento, false, Number(resultado.value));
    });
  }

  private guardarObligado(
    movimiento: Movimiento,
    obligado: boolean,
    motivoNoObligadoId?: number,
  ): void {
    this.servidoresService.cambiarObligado(movimiento.id, obligado, motivoNoObligadoId).subscribe({
      next: () => {
        this.toastService.success('Movimiento actualizado.');
        this.cargar();
      },
      error: (err: HttpErrorResponse) =>
        this.toastService.error(this.mensaje(err) ?? 'No se pudo actualizar el movimiento.'),
    });
  }

  private eliminar(movimiento: Movimiento): void {
    Swal.fire({
      title: '¿Eliminar este movimiento?',
      text: `${movimiento.tipo ?? 'Movimiento'} del ${movimiento.fechaDeclaracion}.`,
      icon: 'warning',
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: 'var(--brand-danger)',
      cancelButtonColor: 'var(--brand-muted)',
    }).then((resultado) => {
      if (!resultado.isConfirmed) return;

      this.servidoresService.eliminarMovimiento(movimiento.id).subscribe({
        next: () => {
          this.toastService.success('Movimiento eliminado.');
          this.cargar();
        },
        error: (err: HttpErrorResponse) =>
          this.toastService.error(this.mensaje(err) ?? 'No se pudo eliminar el movimiento.'),
      });
    });
  }

  private cargar(): void {
    this.cargando.set(true);
    this.servidoresService.movimientos(this.servidorId).subscribe({
      next: (filas) => {
        this.movimientos.set(filas);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.toastService.error('No se pudo cargar el historial de movimientos.');
      },
    });
    this.servidoresService.movimientosPermitidos(this.servidorId).subscribe({
      next: (tipos) => this.permitidos.set(tipos),
      error: () => this.toastService.error('No se pudieron cargar los movimientos permitidos.'),
    });
  }

  private mensaje(err: HttpErrorResponse): string | null {
    const mensaje = err.error?.message;
    if (Array.isArray(mensaje)) return mensaje.join(' ');
    return typeof mensaje === 'string' ? mensaje : null;
  }
}
