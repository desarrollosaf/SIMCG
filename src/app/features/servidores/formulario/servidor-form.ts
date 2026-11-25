import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import Swal from 'sweetalert2';
import {
  CatalogosService,
  Departamento,
  Dependencia,
  Direccion,
  Respuesta,
  TipoMovimiento,
} from '../../../core/services/catalogos.service';
import {
  ActualizarServidor,
  CrearServidor,
  ServidorDetalle,
  ServidoresService,
} from '../../../core/services/servidores.service';
import { ToastService } from '../../../core/services/toast.service';

// Mismas reglas que DatosServidorDto del backend.
const RFC = /^[A-ZÑ&]{4}\d{6}$/;
const HOMOCLAVE = /^[A-Z\d]{3}$/;
const CURP = /^[A-Z]{4}\d{6}[HMX][A-Z]{5}[A-Z\d]\d$/;
const NIVEL_CARGO = /^\d{2}-\d$/;
const CVE_ISSEMYM = /^\d{7}$/;

type CampoTexto =
  | 'nombre'
  | 'primerApellido'
  | 'segundoApellido'
  | 'rfc'
  | 'homoclave'
  | 'curp'
  | 'cargo'
  | 'nivelCargo'
  | 'cveIssemym'
  | 'motivoCorreo';

@Component({
  selector: 'app-servidor-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './servidor-form.html',
  styleUrl: './servidor-form.scss',
})
export class ServidorForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catalogos = inject(CatalogosService);
  private readonly servidoresService = inject(ServidoresService);
  private readonly toastService = inject(ToastService);

  protected readonly id = signal<number | null>(null);
  protected readonly esEdicion = computed(() => this.id() !== null);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);

  protected readonly dependencias = signal<Dependencia[]>([]);
  protected readonly direcciones = signal<Direccion[]>([]);
  protected readonly departamentos = signal<Departamento[]>([]);
  protected readonly respuestas = signal<Respuesta[]>([]);
  protected readonly tiposMovimiento = signal<TipoMovimiento[]>([]);

  protected readonly detalle = signal<ServidorDetalle | null>(null);
  protected readonly versionLarga = signal(false);
  protected readonly cambiarCorreo = signal(false);

  protected readonly form;

  constructor() {
    this.form = this.fb.group({
      // Solo en el alta.
      tipoMovimientoId: [null as number | null],
      fechaDeclaracion: [''],
      fechaInicio: [''],
      rfc: ['', [Validators.required, Validators.pattern(RFC)]],
      homoclave: ['', [Validators.required, Validators.pattern(HOMOCLAVE)]],
      curp: ['', [Validators.required, Validators.pattern(CURP)]],
      nombre: ['', [Validators.required, Validators.maxLength(191)]],
      primerApellido: ['', [Validators.required, Validators.maxLength(191)]],
      segundoApellido: ['', [Validators.maxLength(191)]],
      cargo: ['', [Validators.required, Validators.maxLength(191)]],
      nivelCargo: ['', [Validators.required, Validators.pattern(NIVEL_CARGO)]],
      cveIssemym: ['', [Validators.pattern(CVE_ISSEMYM)]],
      tipoDependenciaId: [null as number | null, [Validators.required]],
      tipoDireccionId: [null as number | null],
      tipoDepartamentoId: [null as number | null],
      honorarios: [null as number | null, [Validators.required]],
      // Solo en la edición, si se cambia el correo del usuario.
      email: [{ value: '', disabled: true }, [Validators.required, Validators.email]],
      motivoCorreo: [{ value: '', disabled: true }, [Validators.required, Validators.minLength(5)]],
    });

    // Cascada dependencia -> dirección -> departamento. Al cargar un servidor se
    // parchea sin emitir eventos para no borrar la selección guardada.
    this.form.controls.tipoDependenciaId.valueChanges.subscribe(() => this.alCambiarDependencia());
    this.form.controls.tipoDireccionId.valueChanges.subscribe(() => this.alCambiarDireccion());
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.id.set(id ? Number(id) : null);

    if (!this.esEdicion()) {
      const alta = this.form.controls;
      alta.tipoMovimientoId.addValidators(Validators.required);
      alta.fechaDeclaracion.addValidators(Validators.required);
      alta.fechaInicio.addValidators(Validators.required);
      for (const c of [alta.tipoMovimientoId, alta.fechaDeclaracion, alta.fechaInicio]) {
        c.updateValueAndValidity();
      }
    }

    this.cargarCatalogos();
    if (this.esEdicion()) this.cargarServidor(this.id()!);
    else this.cargando.set(false);
  }

  /** Muestra en mayúsculas lo que se captura, como lo normaliza el backend. */
  mayusculas(control: CampoTexto, evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const valor = campo.value.toUpperCase();
    this.form.controls[control].setValue(valor, { emitEvent: false });
    campo.value = valor;
  }

  invalido(control: keyof ServidorForm['form']['controls']): boolean {
    const c = this.form.controls[control];
    return c.invalid && (c.touched || c.dirty);
  }

  private alCambiarDependencia(): void {
    this.form.patchValue({ tipoDireccionId: null, tipoDepartamentoId: null });
    this.direcciones.set([]);
    this.departamentos.set([]);
    const id = this.numero(this.form.controls.tipoDependenciaId.value);
    if (id) this.cargarDirecciones(id);
  }

  private alCambiarDireccion(): void {
    this.form.patchValue({ tipoDepartamentoId: null });
    this.departamentos.set([]);
    const id = this.numero(this.form.controls.tipoDireccionId.value);
    if (id) this.cargarDepartamentos(id);
  }

  alternarCorreo(activo: boolean): void {
    this.cambiarCorreo.set(activo);
    const { email, motivoCorreo } = this.form.controls;
    if (activo) {
      email.enable();
      motivoCorreo.enable();
    } else {
      email.setValue(this.detalle()?.email ?? '');
      motivoCorreo.setValue('');
      email.disable();
      motivoCorreo.disable();
    }
  }

  alternarVersionLarga(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const presenta = campo.checked;
    const id = this.id()!;
    // Se revierte el interruptor hasta que el servidor confirme.
    campo.checked = !presenta;

    Swal.fire({
      title: '¿Modificar el registro?',
      text: 'Quedará registrado el cambio en el sistema.',
      icon: 'warning',
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText: 'Aceptar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: 'var(--brand-primary)',
      cancelButtonColor: 'var(--brand-muted)',
    }).then((resultado) => {
      if (!resultado.isConfirmed) return;

      this.servidoresService.versionLarga(id, presenta).subscribe({
        next: () => {
          this.versionLarga.set(presenta);
          campo.checked = presenta;
          this.toastService.success('Cambios guardados correctamente.');
        },
        error: (err: HttpErrorResponse) =>
          this.toastService.error(this.mensaje(err) ?? 'No se pudo guardar el cambio.'),
      });
    });
  }

  cancelar(): void {
    void this.router.navigate(['/servidores']);
  }

  guardar(): void {
    if (this.form.invalid || this.guardando()) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    const v = this.form.getRawValue();
    const datos = {
      nombre: v.nombre!.trim(),
      primerApellido: v.primerApellido!.trim(),
      segundoApellido: v.segundoApellido?.trim() || null,
      rfc: v.rfc!.trim(),
      homoclave: v.homoclave!.trim(),
      curp: v.curp!.trim(),
      cargo: v.cargo!.trim(),
      nivelCargo: v.nivelCargo!.trim(),
      cveIssemym: v.cveIssemym?.trim() || null,
      tipoDependenciaId: Number(v.tipoDependenciaId),
      tipoDireccionId: this.numero(v.tipoDireccionId),
      tipoDepartamentoId: this.numero(v.tipoDepartamentoId),
      honorarios: Number(v.honorarios),
    };

    const peticion = this.esEdicion()
      ? this.servidoresService.actualizar(this.id()!, this.datosEdicion(datos, v))
      : this.servidoresService.crear({
          ...datos,
          fechaInicio: v.fechaInicio!,
          tipoMovimientoId: Number(v.tipoMovimientoId),
          fechaDeclaracion: v.fechaDeclaracion!,
        } satisfies CrearServidor);

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.toastService.success(
          this.esEdicion() ? 'Servidor público actualizado.' : 'Servidor público registrado.',
        );
        void this.router.navigate(['/servidores']);
      },
      error: (err: HttpErrorResponse) => {
        this.guardando.set(false);
        this.toastService.error(this.mensaje(err) ?? 'No se pudo guardar. Intenta de nuevo.');
      },
    });
  }

  private datosEdicion(
    datos: Omit<ActualizarServidor, 'email' | 'motivoCorreo'>,
    v: ReturnType<ServidorForm['form']['getRawValue']>,
  ): ActualizarServidor {
    if (!this.cambiarCorreo()) return datos;
    return { ...datos, email: v.email!.trim(), motivoCorreo: v.motivoCorreo!.trim() };
  }

  private numero(valor: number | string | null): number | null {
    const n = Number(valor);
    return valor === null || valor === '' || !n ? null : n;
  }

  private cargarCatalogos(): void {
    this.catalogos.dependencias().subscribe({
      next: (filas) => this.dependencias.set(filas),
      error: () => this.toastService.error('No se pudieron cargar las dependencias.'),
    });
    this.catalogos.respuestas().subscribe({
      next: (filas) => this.respuestas.set(filas),
      error: () => this.toastService.error('No se pudieron cargar las respuestas.'),
    });
    if (!this.esEdicion()) {
      this.catalogos.tiposMovimiento().subscribe({
        next: (filas) => this.tiposMovimiento.set(filas),
        error: () => this.toastService.error('No se pudieron cargar los tipos de movimiento.'),
      });
    }
  }

  private cargarServidor(id: number): void {
    this.servidoresService.detalle(id).subscribe({
      next: (s) => {
        this.detalle.set(s);
        this.versionLarga.set(s.presentaVersionLarga);
        this.form.patchValue(
          {
            rfc: s.rfc,
            homoclave: s.homoclave,
            curp: s.curp,
            nombre: s.nombre,
            primerApellido: s.primerApellido,
            segundoApellido: s.segundoApellido ?? '',
            cargo: s.cargo,
            nivelCargo: s.nivelCargo,
            cveIssemym: s.cveIssemym ?? '',
            tipoDependenciaId: s.tipoDependenciaId,
            tipoDireccionId: s.tipoDireccionId,
            tipoDepartamentoId: s.tipoDepartamentoId,
            honorarios: s.honorarios,
            fechaInicio: s.fechaInicio,
            email: s.email ?? '',
          },
          { emitEvent: false },
        );
        this.cargarDirecciones(s.tipoDependenciaId);
        if (s.tipoDireccionId) this.cargarDepartamentos(s.tipoDireccionId);
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.toastService.error(this.mensaje(err) ?? 'No se pudo cargar el servidor público.');
        void this.router.navigate(['/servidores']);
      },
    });
  }

  private cargarDirecciones(dependenciaId: number): void {
    this.catalogos.direcciones(dependenciaId).subscribe({
      next: (filas) => this.direcciones.set(filas),
      error: () => this.toastService.error('No se pudieron cargar las direcciones.'),
    });
  }

  private cargarDepartamentos(direccionId: number): void {
    this.catalogos.departamentos(direccionId).subscribe({
      next: (filas) => this.departamentos.set(filas),
      error: () => this.toastService.error('No se pudieron cargar los departamentos.'),
    });
  }

  private mensaje(err: HttpErrorResponse): string | null {
    const mensaje = err.error?.message;
    if (Array.isArray(mensaje)) return mensaje.join(' ');
    return typeof mensaje === 'string' ? mensaje : null;
  }
}
