import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
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
import { ConfirmacionService } from '../../../shared/confirmacion/confirmacion.service';
import { Icono } from '../../../shared/icono/icono';
import { Modal } from '../../../shared/modal/modal';
import { CambioCampo, calcularCambios } from './cambios-servidor';
import { ConfirmarCambios } from './confirmar-cambios';
import { ConCambiosPendientes, cerrarModalServidores } from '../servidores-navegacion';
import { ServidoresRefresco } from '../servidores-refresco';

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
  | 'cveIssemym';

@Component({
  selector: 'app-servidor-form',
  standalone: true,
  imports: [ReactiveFormsModule, Modal, ConfirmarCambios, Icono],
  templateUrl: './servidor-form.html',
  styleUrl: './servidor-form.scss',
})
export class ServidorForm implements ConCambiosPendientes {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly catalogos = inject(CatalogosService);
  private readonly servidoresService = inject(ServidoresService);
  private readonly toastService = inject(ToastService);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly refresco = inject(ServidoresRefresco);

  /** Parámetro `:id` de la ruta (enlazado por withComponentInputBinding); sin él es un alta. */
  readonly id = input<string | undefined>();

  protected readonly idNumerico = computed(() => {
    const id = this.id();
    return id === undefined || id === '' ? null : Number(id);
  });
  protected readonly esEdicion = computed(() => this.idNumerico() !== null);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly intentado = signal(false);

  protected readonly dependencias = signal<Dependencia[]>([]);
  protected readonly direcciones = signal<Direccion[]>([]);
  protected readonly departamentos = signal<Departamento[]>([]);
  protected readonly respuestas = signal<Respuesta[]>([]);
  protected readonly tiposMovimiento = signal<TipoMovimiento[]>([]);

  protected readonly detalle = signal<ServidorDetalle | null>(null);
  protected readonly versionLarga = signal(false);
  /** El correo es de solo lectura hasta que el usuario confirma que quiere cambiarlo. */
  protected readonly editandoCorreo = signal(false);
  /** Cambios por confirmar (con motivo) antes de guardar la edición; null = sin modal. */
  protected readonly cambiosPorConfirmar = signal<CambioCampo[] | null>(null);
  // Nombres de catálogo ya vistos (ids de adscripción y honorarios), para mostrar antes → después.
  private readonly nombres = new Map<string, string>();

  protected readonly subtitulo = computed(() => {
    const d = this.detalle();
    return d
      ? [d.nombre, d.primerApellido, d.segundoApellido].filter(Boolean).join(' ')
      : undefined;
  });

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
      // Solo en la edición: correo del usuario en Declaranet.
      email: ['', [Validators.email]],
    });

    // Cascada dependencia -> dirección -> departamento. Al cargar un servidor se
    // parchea sin emitir eventos para no borrar la selección guardada.
    this.form.controls.tipoDependenciaId.valueChanges.subscribe(() => this.alCambiarDependencia());
    this.form.controls.tipoDireccionId.valueChanges.subscribe(() => this.alCambiarDireccion());

    // Carga inicial y recarga si el router reutiliza el componente con otro :id.
    effect(() => {
      const id = this.idNumerico();
      untracked(() => this.iniciar(id));
    });
  }

  /** Lo consulta el guard de la ruta: pide confirmar antes de perder cambios sin guardar. */
  puedeSalir(): boolean | Promise<boolean> {
    if (!this.form.dirty || this.guardando()) return true;
    return this.confirmacion.confirmar({
      titulo: '¿Descartar cambios?',
      mensaje: 'Hay cambios sin guardar. Si sales ahora, se perderán.',
      textoConfirmar: 'Descartar',
      textoCancelar: 'Seguir editando',
      peligro: true,
    });
  }

  /** Cierra el modal; si hay cambios sin guardar, el guard de la ruta pregunta antes. */
  cerrar(): void {
    void cerrarModalServidores(this.router);
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
    return c.invalid && (c.touched || c.dirty || this.intentado());
  }

  /** Desbloquea el correo previa confirmación (los cambios quedan registrados). */
  async editarCorreo(): Promise<void> {
    if (this.editandoCorreo()) return;
    const acepta = await this.confirmacion.confirmar({
      titulo: '¿Está seguro que desea modificar la información?',
      mensaje: 'Se quedarán registrados los cambios que realices en el sistema.',
      textoConfirmar: 'Aceptar',
    });
    if (acepta) this.editandoCorreo.set(true);
  }

  async alternarVersionLarga(evento: Event): Promise<void> {
    const campo = evento.target as HTMLInputElement;
    const presenta = campo.checked;
    const id = this.idNumerico();
    // Se revierte el interruptor hasta que el servidor confirme.
    campo.checked = !presenta;
    if (id === null) return;

    const acepta = await this.confirmacion.confirmar({
      titulo: '¿Modificar el registro?',
      mensaje: 'Quedará registrado el cambio en el sistema.',
      textoConfirmar: 'Aceptar',
    });
    if (!acepta) return;

    this.servidoresService.versionLarga(id, presenta).subscribe({
      next: () => {
        this.versionLarga.set(presenta);
        campo.checked = presenta;
        this.toastService.success('Cambios guardados correctamente.');
        this.refresco.notificar();
      },
      error: (err: unknown) => this.toastService.errorHttp(err, 'No se pudo guardar el cambio.'),
    });
  }

  guardar(): void {
    this.intentado.set(true);
    if (this.form.invalid || this.guardando()) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.esEdicion()) {
      this.enviar();
      return;
    }

    // En la edición se muestran los cambios y se pide el motivo antes de guardar.
    const cambios = this.cambios();
    if (cambios.length === 0) {
      this.toastService.info('No hay cambios que guardar.');
      return;
    }
    this.cambiosPorConfirmar.set(cambios);
  }

  /** Cambios del formulario contra lo guardado (vacío en el alta o si no hay detalle). */
  cambios(): CambioCampo[] {
    const d = this.detalle();
    if (!d) return [];
    const v = this.form.getRawValue();
    const despues: Record<string, string | number | null> = {
      rfc: v.rfc,
      homoclave: v.homoclave,
      curp: v.curp,
      nombre: v.nombre,
      primerApellido: v.primerApellido,
      segundoApellido: v.segundoApellido,
      cargo: v.cargo,
      nivelCargo: v.nivelCargo,
      cveIssemym: v.cveIssemym,
      tipoDependenciaId: this.numero(v.tipoDependenciaId),
      tipoDireccionId: this.numero(v.tipoDireccionId),
      tipoDepartamentoId: this.numero(v.tipoDepartamentoId),
      honorarios: this.numero(v.honorarios),
    };
    // El correo solo cuenta si se desbloqueó.
    if (this.editandoCorreo()) despues['email'] = v.email;
    return calcularCambios(
      d as unknown as Record<string, string | number | null>,
      despues,
      (campo, valor) => this.nombrar(campo, valor),
    );
  }

  cancelarConfirmacion(): void {
    if (!this.guardando()) this.cambiosPorConfirmar.set(null);
  }

  confirmarCambios(motivo: string): void {
    this.enviar(motivo);
  }

  private enviar(motivo?: string): void {
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

    const id = this.idNumerico();
    const peticion =
      id !== null
        ? this.servidoresService.actualizar(id, this.datosEdicion(datos, v, motivo))
        : this.servidoresService.crear({
            ...datos,
            fechaInicio: v.fechaInicio!,
            tipoMovimientoId: Number(v.tipoMovimientoId),
            fechaDeclaracion: v.fechaDeclaracion!,
          } satisfies CrearServidor);

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.cambiosPorConfirmar.set(null);
        this.form.markAsPristine();
        this.toastService.success(
          this.esEdicion() ? 'Servidor público actualizado.' : 'Servidor público registrado.',
        );
        this.refresco.notificar();
        this.cerrar();
      },
      error: (err: unknown) => {
        this.guardando.set(false);
        // Vuelve al formulario para corregir (CURP repetida, correo en uso…).
        this.cambiosPorConfirmar.set(null);
        this.toastService.errorHttp(err, 'No se pudo guardar. Intenta de nuevo.');
      },
    });
  }

  private datosEdicion(
    datos: Omit<ActualizarServidor, 'email' | 'motivo'>,
    v: ReturnType<ServidorForm['form']['getRawValue']>,
    motivo: string | undefined,
  ): ActualizarServidor {
    const correoCambio =
      this.editandoCorreo() && (v.email ?? '').trim() !== (this.detalle()?.email ?? '');
    return {
      ...datos,
      ...(correoCambio ? { email: v.email!.trim() } : {}),
      ...(motivo ? { motivo } : {}),
    };
  }

  /** Texto de un valor de catálogo guardado por id; el resto de campos va tal cual. */
  private nombrar(campo: string, valor: string): string {
    const prefijo =
      campo === 'tipoDependenciaId'
        ? 'dependencia'
        : campo === 'tipoDireccionId'
          ? 'direccion'
          : campo === 'tipoDepartamentoId'
            ? 'departamento'
            : campo === 'honorarios'
              ? 'honorarios'
              : null;
    return prefijo ? (this.nombres.get(`${prefijo}:${valor}`) ?? valor) : valor;
  }

  private recordar(prefijo: string, filas: { id: number; nombre?: string; respuesta?: string }[]) {
    for (const f of filas) this.nombres.set(`${prefijo}:${f.id}`, f.nombre ?? f.respuesta ?? '');
  }

  private numero(valor: number | string | null): number | null {
    const n = Number(valor);
    return valor === null || valor === '' || !n ? null : n;
  }

  private iniciar(id: number | null): void {
    this.cargando.set(true);
    this.detalle.set(null);
    this.versionLarga.set(false);
    this.intentado.set(false);
    this.direcciones.set([]);
    this.departamentos.set([]);
    this.form.reset(undefined, { emitEvent: false });
    this.editandoCorreo.set(false);
    this.cambiosPorConfirmar.set(null);
    this.nombres.clear();

    // Los campos del movimiento inicial solo se capturan en el alta; en la edición se muestran
    // (solo lectura, fuera del formulario).
    const { tipoMovimientoId, fechaDeclaracion, fechaInicio, email, cveIssemym } =
      this.form.controls;
    for (const c of [tipoMovimientoId, fechaDeclaracion, fechaInicio]) {
      if (id === null) c.addValidators(Validators.required);
      else c.removeValidators(Validators.required);
      c.updateValueAndValidity({ emitEvent: false });
    }
    // La clave ISSEMYM es obligatoria (como en el sistema viejo).
    cveIssemym.addValidators(Validators.required);
    cveIssemym.updateValueAndValidity({ emitEvent: false });
    email.removeValidators(Validators.required);
    email.updateValueAndValidity({ emitEvent: false });

    this.cargarCatalogos(id === null);
    if (id !== null) this.cargarServidor(id);
    else this.cargando.set(false);
  }

  private alCambiarDependencia(): void {
    this.form.patchValue({ tipoDireccionId: null, tipoDepartamentoId: null });
    this.direcciones.set([]);
    this.departamentos.set([]);
    this.exigir(this.form.controls.tipoDireccionId, false);
    this.exigir(this.form.controls.tipoDepartamentoId, false);
    const id = this.numero(this.form.controls.tipoDependenciaId.value);
    if (id) this.cargarDirecciones(id);
  }

  private alCambiarDireccion(): void {
    this.form.patchValue({ tipoDepartamentoId: null });
    this.departamentos.set([]);
    this.exigir(this.form.controls.tipoDepartamentoId, false);
    const id = this.numero(this.form.controls.tipoDireccionId.value);
    if (id) this.cargarDepartamentos(id);
  }

  private cargarCatalogos(alta: boolean): void {
    this.catalogos.dependencias().subscribe({
      next: (filas) => {
        this.recordar('dependencia', filas);
        this.dependencias.set(filas);
      },
      error: (err: unknown) =>
        this.toastService.errorHttp(err, 'No se pudieron cargar las dependencias.'),
    });
    this.catalogos.respuestas().subscribe({
      next: (filas) => {
        this.recordar('honorarios', filas);
        this.respuestas.set(filas);
      },
      error: (err: unknown) =>
        this.toastService.errorHttp(err, 'No se pudieron cargar las respuestas.'),
    });
    if (alta) {
      this.catalogos.tiposMovimiento().subscribe({
        next: (filas) => this.tiposMovimiento.set(filas),
        error: (err: unknown) =>
          this.toastService.errorHttp(err, 'No se pudieron cargar los tipos de movimiento.'),
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
        if (s.email) this.form.controls.email.addValidators(Validators.required);
        this.form.controls.email.updateValueAndValidity({ emitEvent: false });
        this.form.markAsPristine();
        this.cargarDirecciones(s.tipoDependenciaId);
        if (s.tipoDireccionId) this.cargarDepartamentos(s.tipoDireccionId);
        this.cargando.set(false);
      },
      error: (err: unknown) => {
        this.toastService.errorHttp(err, 'No se pudo cargar el servidor público.');
        this.cerrar();
      },
    });
  }

  /** Dirección y departamento son obligatorios solo si la dependencia (o dirección) tiene opciones. */
  private exigir(control: AbstractControl, exige: boolean): void {
    if (exige) control.addValidators(Validators.required);
    else control.removeValidators(Validators.required);
    control.updateValueAndValidity({ emitEvent: false });
  }

  private cargarDirecciones(dependenciaId: number): void {
    this.catalogos.direcciones(dependenciaId).subscribe({
      next: (filas) => {
        this.recordar('direccion', filas);
        this.direcciones.set(filas);
        this.exigir(this.form.controls.tipoDireccionId, filas.length > 0);
      },
      error: (err: unknown) =>
        this.toastService.errorHttp(err, 'No se pudieron cargar las direcciones.'),
    });
  }

  private cargarDepartamentos(direccionId: number): void {
    this.catalogos.departamentos(direccionId).subscribe({
      next: (filas) => {
        this.recordar('departamento', filas);
        this.departamentos.set(filas);
        this.exigir(this.form.controls.tipoDepartamentoId, filas.length > 0);
      },
      error: (err: unknown) =>
        this.toastService.errorHttp(err, 'No se pudieron cargar los departamentos.'),
    });
  }
}
