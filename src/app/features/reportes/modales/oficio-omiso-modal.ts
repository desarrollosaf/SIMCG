import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FilaReporte, ReportesService } from '../../../core/services/reportes.service';
import { ToastService } from '../../../core/services/toast.service';
import { Modal } from '../../../shared/modal/modal';
import { abrirPdf } from '../../../shared/utils/descarga';
import { nombreFila } from '../reportes-presentacion';

export const PREFIJO_OFICIO = 'CPL/DSP/MCG/';

/** Solo el número del folio: quita el prefijo CPL/DSP/MCG/ si viene. */
export function folioSinPrefijo(folio: string): string {
  const limpio = folio.trim();
  return limpio.toUpperCase().startsWith(PREFIJO_OFICIO)
    ? limpio.slice(PREFIJO_OFICIO.length).trim()
    : limpio;
}

const noVacio = Validators.pattern(/\S/);

/** Modal «Generar oficio» de remisión (omisos): arma el PDF y lo abre en una pestaña nueva. */
@Component({
  selector: 'app-oficio-omiso-modal',
  standalone: true,
  imports: [ReactiveFormsModule, Modal],
  templateUrl: './oficio-omiso-modal.html',
  styleUrl: './modales.scss',
})
export class OficioOmisoModal implements OnInit {
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
    folio: ['', [Validators.required, noVacio, Validators.maxLength(100)]],
    folioDadp: ['', [Validators.required, noVacio, Validators.maxLength(150)]],
    fechaOficio: ['', Validators.required],
    fechaPadron: ['', Validators.required],
    soporte: ['', [Validators.required, noVacio, Validators.maxLength(5000)]],
  });

  protected nombre(): string {
    return nombreFila(this.fila());
  }

  ngOnInit(): void {
    this.consultarFolio();
  }

  protected invalido(campo: 'folio' | 'folioDadp' | 'fechaOficio' | 'fechaPadron' | 'soporte'): boolean {
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
      .generarOficioOmiso({
        declaracionId: this.fila().id,
        folio: folioSinPrefijo(v.folio),
        folioDadp: v.folioDadp.trim(),
        fechaOficio: v.fechaOficio,
        fechaPadron: v.fechaPadron,
        soporte: v.soporte.trim(),
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

  /** Si la declaración ya tiene oficio de remisión se precarga su número en solo lectura. */
  private consultarFolio(): void {
    this.reportes.oficioPrevioOmiso(this.fila().id).subscribe({
      next: ({ noOficio }) => {
        if (!noOficio) return;
        this.form.controls.folio.setValue(folioSinPrefijo(noOficio));
        this.folioBloqueado.set(true);
      },
      // Sin el dato el usuario captura el folio a mano.
      error: () => this.folioBloqueado.set(false),
    });
  }
}
