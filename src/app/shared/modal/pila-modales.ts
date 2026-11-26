import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

const CLASE_BLOQUEO = 'modal-abierto';
const Z_BASE = 1100;
const Z_PASO = 10;

/**
 * Lleva la cuenta de los modales abiertos: decide cuál es el superior (el único que responde a Esc),
 * su nivel de apilado (los anidados quedan sobre sus padres) y bloquea el scroll del body
 * mientras haya al menos uno.
 */
@Injectable({ providedIn: 'root' })
export class PilaModales {
  private readonly body = inject(DOCUMENT).body;
  private readonly pila: symbol[] = [];

  /** Registra un modal y devuelve su z-index. */
  abrir(token: symbol): number {
    this.pila.push(token);
    this.body.classList.add(CLASE_BLOQUEO);
    return Z_BASE + (this.pila.length - 1) * Z_PASO;
  }

  cerrar(token: symbol): void {
    const indice = this.pila.indexOf(token);
    if (indice >= 0) this.pila.splice(indice, 1);
    if (this.pila.length === 0) this.body.classList.remove(CLASE_BLOQUEO);
  }

  esSuperior(token: symbol): boolean {
    return this.pila[this.pila.length - 1] === token;
  }

  get abiertos(): number {
    return this.pila.length;
  }
}
