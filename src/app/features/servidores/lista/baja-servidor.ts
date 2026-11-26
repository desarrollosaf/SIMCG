import { Component, inject, input, output, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ServidorFila, ServidoresService } from '../../../core/services/servidores.service';
import { ToastService } from '../../../core/services/toast.service';
import { Modal } from '../../../shared/modal/modal';

export const MOTIVO_MIN = 5;
export const MOTIVO_MAX = 500;

/** Mínimo de caracteres sin contar los espacios de los extremos. */
export function minimoSinEspacios(minimo: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const largo = String(control.value ?? '').trim().length;
    return largo > 0 && largo < minimo
      ? { minlength: { requiredLength: minimo, actualLength: largo } }
      : null;
  };
}

@Component({
  selector: 'app-baja-servidor',
  standalone: true,
  imports: [ReactiveFormsModule, Modal],
  templateUrl: './baja-servidor.html',
  styleUrl: './baja-servidor.scss',
})
export class BajaServidor {
  private readonly fb = inject(FormBuilder);
  private readonly servidoresService = inject(ServidoresService);
  private readonly toastService = inject(ToastService);

  readonly servidor = input.required<ServidorFila>();
  readonly cerrar = output<void>();
  /** Se emitió la baja en el servidor; el padre cierra y recarga la lista. */
  readonly completada = output<void>();

  protected readonly guardando = signal(false);
  protected readonly intentado = signal(false);
  protected readonly maximo = MOTIVO_MAX;
  protected readonly minimo = MOTIVO_MIN;

  protected readonly form = this.fb.nonNullable.group({
    motivo: [
      '',
      [Validators.required, minimoSinEspacios(MOTIVO_MIN), Validators.maxLength(MOTIVO_MAX)],
    ],
  });

  protected get mostrarError(): boolean {
    const c = this.form.controls.motivo;
    return c.invalid && (c.touched || this.intentado());
  }

  confirmar(): void {
    this.intentado.set(true);
    if (this.form.invalid || this.guardando()) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    const motivo = this.form.controls.motivo.value.trim();
    this.servidoresService.baja(this.servidor().id, motivo).subscribe({
      next: () => {
        this.guardando.set(false);
        this.toastService.success('Servidor público dado de baja.');
        this.completada.emit();
      },
      error: (err: unknown) => {
        this.guardando.set(false);
        this.toastService.errorHttp(err, 'No se pudo dar de baja al servidor.');
      },
    });
  }
}
