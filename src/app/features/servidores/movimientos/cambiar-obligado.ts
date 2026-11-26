import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CatalogosService, MotivoNoObligado } from '../../../core/services/catalogos.service';
import { Movimiento, ServidoresService } from '../../../core/services/servidores.service';
import { ToastService } from '../../../core/services/toast.service';
import { Modal } from '../../../shared/modal/modal';

type Obligado = 'si' | 'no';

/** Modal para marcar un movimiento como obligado o no obligado (con motivo). */
@Component({
  selector: 'app-cambiar-obligado',
  standalone: true,
  imports: [ReactiveFormsModule, Modal],
  templateUrl: './cambiar-obligado.html',
  styleUrl: './cambiar-obligado.scss',
})
export class CambiarObligado implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly catalogos = inject(CatalogosService);
  private readonly servidoresService = inject(ServidoresService);
  private readonly toastService = inject(ToastService);

  readonly movimiento = input.required<Movimiento>();
  readonly cerrar = output<void>();
  /** El cambio ya se guardó en el servidor. */
  readonly guardado = output<void>();

  protected readonly motivos = signal<MotivoNoObligado[]>([]);
  protected readonly cargandoMotivos = signal(true);
  protected readonly guardando = signal(false);
  protected readonly intentado = signal(false);

  protected readonly form = this.fb.group({
    obligado: ['si' as Obligado],
    motivoNoObligadoId: [null as number | null],
  });

  constructor() {
    this.form.controls.obligado.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((valor) => this.aplicarValidacion(valor));
  }

  ngOnInit(): void {
    this.precargar();
    this.catalogos.motivosNoObligado().subscribe({
      next: (motivos) => {
        this.motivos.set(motivos);
        this.cargandoMotivos.set(false);
      },
      error: (err: unknown) => {
        this.cargandoMotivos.set(false);
        this.toastService.errorHttp(err, 'No se pudieron cargar los motivos.');
      },
    });
  }

  protected get exigeMotivo(): boolean {
    return this.form.controls.obligado.value === 'no';
  }

  protected get motivoInvalido(): boolean {
    const c = this.form.controls.motivoNoObligadoId;
    return c.invalid && (c.touched || this.intentado());
  }

  guardar(): void {
    this.intentado.set(true);
    if (this.form.invalid || this.guardando()) {
      this.form.markAllAsTouched();
      return;
    }

    const { obligado, motivoNoObligadoId } = this.form.getRawValue();
    const esObligado = obligado === 'si';
    this.guardando.set(true);
    this.servidoresService
      .cambiarObligado(
        this.movimiento().id,
        esObligado,
        esObligado ? undefined : Number(motivoNoObligadoId),
      )
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.toastService.success('Declaración guardada correctamente');
          this.guardado.emit();
        },
        error: (err: unknown) => {
          this.guardando.set(false);
          this.toastService.errorHttp(err, 'No se pudo actualizar el movimiento.');
        },
      });
  }

  /** Estado actual del movimiento como valor inicial del formulario. */
  private precargar(): void {
    const m = this.movimiento();
    this.form.setValue({
      obligado: m.obligado ? 'si' : 'no',
      motivoNoObligadoId: m.motivoNoObligadoId,
    });
  }

  private aplicarValidacion(valor: Obligado | null): void {
    const motivo = this.form.controls.motivoNoObligadoId;
    if (valor === 'no') {
      motivo.addValidators(Validators.required);
    } else {
      motivo.removeValidators(Validators.required);
      motivo.setValue(null);
    }
    motivo.updateValueAndValidity();
  }
}
