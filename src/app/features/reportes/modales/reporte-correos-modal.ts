import { Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ReportesService, TipoReporteCorreo } from '../../../core/services/reportes.service';
import { ToastService } from '../../../core/services/toast.service';
import { Modal } from '../../../shared/modal/modal';
import { descargarBlob, nombreDeContentDisposition } from '../../../shared/utils/descarga';

/** Modal «Reporte correos preventivos»: pide el rango de fechas y descarga el Excel. */
@Component({
  selector: 'app-reporte-correos-modal',
  standalone: true,
  imports: [ReactiveFormsModule, Modal],
  templateUrl: './reporte-correos-modal.html',
  styleUrl: './modales.scss',
})
export class ReporteCorreosModal {
  private readonly fb = inject(FormBuilder);
  private readonly reportes = inject(ReportesService);
  private readonly toast = inject(ToastService);

  readonly tipo = input<TipoReporteCorreo>('PREVENTIVO');
  readonly cerrar = output<void>();

  protected readonly guardando = signal(false);
  protected readonly intentado = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    fechaInicio: ['', Validators.required],
    fechaFin: ['', Validators.required],
  });

  protected invalido(campo: 'fechaInicio' | 'fechaFin'): boolean {
    const c = this.form.controls[campo];
    return c.invalid && (c.touched || this.intentado());
  }

  generar(): void {
    this.intentado.set(true);
    if (this.form.invalid || this.guardando()) {
      this.form.markAllAsTouched();
      return;
    }
    const { fechaInicio, fechaFin } = this.form.getRawValue();
    this.guardando.set(true);
    this.reportes.excelCorreos(this.tipo(), fechaInicio, fechaFin).subscribe({
      next: (respuesta) => {
        this.guardando.set(false);
        if (respuesta.body) {
          descargarBlob(respuesta.body, nombreDeContentDisposition(respuesta) ?? 'correo.xlsx');
        }
        this.cerrar.emit();
      },
      error: (err: unknown) => {
        this.guardando.set(false);
        this.toast.errorHttp(err, 'No se pudo generar el reporte.');
      },
    });
  }
}
