import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

/**
 * Aviso interno del módulo: los modales hijos (alta, edición, movimientos) lo usan para que la
 * lista recargue su página actual sin salir de ella. Se provee en la ruta de Servidores.
 */
@Injectable()
export class ServidoresRefresco {
  private readonly cambios = new Subject<void>();

  readonly cambios$: Observable<void> = this.cambios.asObservable();

  notificar(): void {
    this.cambios.next();
  }
}
