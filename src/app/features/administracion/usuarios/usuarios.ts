import { Component, computed, signal, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import Swal from 'sweetalert2';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-community';
import { ROLES_SIMCG } from '../../../core/access/acceso-por-rol';
import { AuthService } from '../../../core/services/auth.service';
import { UsuarioAcceso, UsuariosService } from '../../../core/services/usuarios.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  AG_GRID_COLUMNA_BASE,
  AG_GRID_LOCALE,
  simcgGridTheme,
} from '../../../shared/ag-grid/ag-grid-setup';
import { BotonCeldaComponent } from '../../../shared/ag-grid/boton-celda';

// Mismas reglas que AccesoDto del backend.
const RFC = /^[A-ZÑ&]{4}\d{6}$/;
const CURP = /^[A-Z]{4}\d{6}[HMX][A-Z]{5}[A-Z\d]\d$/;
const HOMOCLAVE = /^[A-Z\d]{3}$/;

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [ReactiveFormsModule, AgGridAngular],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.scss',
})
export class Usuarios {
  private readonly fb = inject(FormBuilder);
  private readonly usuariosService = inject(UsuariosService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);

  protected readonly roles = ROLES_SIMCG;
  protected readonly usuarios = signal<UsuarioAcceso[]>([]);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);

  protected readonly form;

  protected readonly gridTheme = simcgGridTheme;
  protected readonly localeText = AG_GRID_LOCALE;
  protected readonly columnaBase = AG_GRID_COLUMNA_BASE;
  protected readonly filas = computed(() => this.usuarios());
  protected readonly columnas: ColDef<UsuarioAcceso>[] = [
    { field: 'nombre', headerName: 'Nombre', minWidth: 220, flex: 1.6 },
    { field: 'curp', headerName: 'CURP', minWidth: 180, flex: 1.1 },
    { field: 'dependencia', headerName: 'Dependencia', minWidth: 200, flex: 1.3 },
    { field: 'email', headerName: 'Usuario', minWidth: 200, flex: 1.3 },
    {
      headerName: 'Rol',
      minWidth: 120,
      flex: 0.8,
      valueGetter: (p) => p.data?.roles.join(', '),
    },
    {
      headerName: 'Acciones',
      headerClass: 'ag-center-aligned-header',
      width: 115,
      pinned: 'right',
      sortable: false,
      filter: false,
      resizable: false,
      cellRenderer: BotonCeldaComponent,
      cellRendererParams: {
        label: 'Baja',
        onClick: (data: UsuarioAcceso) => this.baja(data),
        visible: (data: UsuarioAcceso) => data.id !== this.authService.currentUser()?.id,
      },
    },
  ];

  constructor() {
    this.form = this.fb.group({
      rfc: ['', [Validators.required, Validators.pattern(RFC)]],
      curp: ['', [Validators.required, Validators.pattern(CURP)]],
      homoclave: ['', [Validators.required, Validators.pattern(HOMOCLAVE)]],
      rol: ['', [Validators.required]],
    });
    this.cargar();
  }

  /** Muestra en mayúsculas lo que se captura, como lo normaliza el backend. */
  mayusculas(control: 'rfc' | 'curp' | 'homoclave', evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value.toUpperCase();
    this.form.controls[control].setValue(valor, { emitEvent: false });
    (evento.target as HTMLInputElement).value = valor;
  }

  invalido(control: 'rfc' | 'curp' | 'homoclave' | 'rol'): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.touched || c.dirty);
  }

  darAcceso(): void {
    if (this.form.invalid || this.guardando()) {
      this.form.markAllAsTouched();
      return;
    }

    const { rfc, curp, homoclave, rol } = this.form.getRawValue();
    this.guardando.set(true);

    this.usuariosService
      .darAcceso({ rfc: rfc!.trim(), curp: curp!.trim(), homoclave: homoclave!.trim(), rol: rol! })
      .subscribe({
        next: (usuario) => {
          this.guardando.set(false);
          this.toastService.success(`${usuario.nombre} ahora tiene el rol ${rol}.`);
          this.form.reset({ rfc: '', curp: '', homoclave: '', rol: '' });
          this.cargar();
        },
        error: (err: HttpErrorResponse) => {
          this.guardando.set(false);
          this.toastService.error(this.mensaje(err) ?? 'No se pudo dar acceso. Intenta de nuevo.');
        },
      });
  }

  baja(usuario: UsuarioAcceso): void {
    Swal.fire({
      title: '¿Dar de baja este usuario?',
      text: `${usuario.nombre} perderá el acceso al sistema.`,
      icon: 'warning',
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText: 'Sí, dar de baja',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: 'var(--brand-danger)',
      cancelButtonColor: 'var(--brand-muted)',
    }).then((resultado) => {
      if (!resultado.isConfirmed) return;

      this.usuariosService.baja(usuario.id).subscribe({
        next: () => {
          this.toastService.success('Usuario dado de baja.');
          this.cargar();
        },
        error: (err: HttpErrorResponse) =>
          this.toastService.error(this.mensaje(err) ?? 'No se pudo dar de baja al usuario.'),
      });
    });
  }

  private mensaje(err: HttpErrorResponse): string | null {
    const mensaje = err.error?.message;
    if (Array.isArray(mensaje)) return mensaje.join(' ');
    return typeof mensaje === 'string' ? mensaje : null;
  }

  private cargar(): void {
    this.cargando.set(true);
    this.usuariosService.listar().subscribe({
      next: (usuarios) => {
        this.usuarios.set(usuarios);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.toastService.error('No se pudieron cargar los usuarios.');
      },
    });
  }
}
