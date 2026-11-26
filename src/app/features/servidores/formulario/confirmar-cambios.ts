import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Modal } from '../../../shared/modal/modal';
import { CambioCampo } from './cambios-servidor';

/** Confirmación de la edición: lista lo que cambió y pide el motivo (obligatorio). */
@Component({
  selector: 'app-confirmar-cambios',
  standalone: true,
  imports: [ReactiveFormsModule, Modal],
  templateUrl: './confirmar-cambios.html',
  styleUrl: './confirmar-cambios.scss',
})
export class ConfirmarCambios {
  readonly cambios = input.required<CambioCampo[]>();
  readonly guardando = input(false);
  /** Vuelve al formulario sin guardar. */
  readonly cancelar = output<void>();
  /** El usuario confirmó; emite el motivo capturado. */
  readonly confirmar = output<string>();

  private readonly fb = inject(FormBuilder);

  protected readonly intentado = signal(false);
  protected readonly form = this.fb.group({
    motivo: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(500)]],
  });

  protected get motivoInvalido(): boolean {
    const c = this.form.controls.motivo;
    return c.invalid && (c.touched || this.intentado());
  }

  aceptar(): void {
    this.intentado.set(true);
    const motivo = (this.form.controls.motivo.value ?? '').trim();
    if (this.guardando()) return;
    if (this.form.invalid || motivo.length < 5) {
      this.form.markAllAsTouched();
      return;
    }
    this.confirmar.emit(motivo);
  }
}
