import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FilaReporte, ReportesService } from '../../../core/services/reportes.service';
import { ToastService } from '../../../core/services/toast.service';
import { Modal } from '../../../shared/modal/modal';
import { abrirPdf } from '../../../shared/utils/descarga';
import { nombreFila } from '../reportes-presentacion';
import { PREFIJO_OFICIO, folioSinPrefijo } from './oficio-omiso-modal';

/** Modal «Generar oficio» preventivo: arma el PDF y lo abre en una pestaña nueva. */
@Component({
  selector: 'app-oficio-preventivo-modal',
  standalone: true,
  imports: [ReactiveFormsModule, Modal],
  templateUrl: './oficio-preventivo-modal.html',
  styleUrl: './modales.scss',
})
export class OficioPreventivoModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly reportes = inject(ReportesService);
  private readonly toast = inject(ToastService);

  readonly fila = input.required<FilaReporte>();
  readonly cerrar = output<void>();

  protected readonly guardando = signal(false);
  protected readonly intentado = signal(false);
  /** El oficio ya tiene número registrado: se muestra y no se puede cambiar. */
  protected readonly folioBloqueado = signal(false);
  protected readonly prefijo = PREFIJO_OFICIO;

  protected readonly form = this.fb.nonNullable.group({
    folio: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)]],
    fechaOficio: ['', Validators.required],
  });

  ngOnInit(): void {
    this.consultarFolio();
  }

  protected nombre(): string {
    return nombreFila(this.fila(), true);
  }

  protected invalido(campo: 'folio' | 'fechaOficio'): boolean {
    const c = this.form.controls[campo];
    return c.invalid && (c.touched || this.intentado());
  }

  generar(): void {
    this.intentado.set(true);
    if (this.form.invalid || this.guardando()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.guardando.set(true);
    this.reportes
      .generarOficioPreventivo({
        declaracionId: this.fila().id,
        folio: folioSinPrefijo(v.folio),
        fechaOficio: v.fechaOficio,
      })
      .subscribe({
        next: (pdf) => {
          this.guardando.set(false);
          abrirPdf(pdf);
          this.toast.success('Oficio generado.');
          this.cerrar.emit();
        },
        error: (err: unknown) => {
          this.guardando.set(false);
          this.toast.errorHttp(err, 'No se pudo generar el oficio.');
        },
      });
  }

  /** Si la declaración ya tiene oficio preventivo se precarga su número en solo lectura. */
  private consultarFolio(): void {
    this.reportes.oficioPrevioPreventivo(this.fila().id).subscribe({
      next: ({ noOficio }) => {
        if (!noOficio) return;
        this.form.controls.folio.setValue(folioSinPrefijo(noOficio));
        this.folioBloqueado.set(true);
      },
      error: () => this.folioBloqueado.set(false),
    });
  }
}
