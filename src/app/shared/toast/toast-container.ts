import { Component, inject } from '@angular/core';
import { ToastAccion, ToastService } from '../../core/services/toast.service';
import { Icono } from '../icono/icono';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [Icono],
  templateUrl: './toast-container.html',
  styleUrl: './toast-container.scss',
})
export class ToastContainer {
  protected readonly toastService = inject(ToastService);

  protected ejecutarAccion(id: number, accion: ToastAccion): void {
    accion.ejecutar();
    this.toastService.dismiss(id);
  }
}
