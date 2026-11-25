import { Component, ElementRef, computed, input, model, signal, viewChild } from '@angular/core';

let siguienteId = 0;

/** Valida extensión y tamaño; devuelve el mensaje de error o null si el archivo es válido. */
export function validarArchivo(
  archivo: File,
  extensiones: readonly string[],
  maxBytes: number,
): string | null {
  const nombre = archivo.name.toLowerCase();
  if (extensiones.length && !extensiones.some((ext) => nombre.endsWith(ext.toLowerCase()))) {
    return `Formato no permitido. Usa: ${extensiones.join(', ')}.`;
  }
  if (archivo.size > maxBytes) {
    return `El archivo supera el máximo de ${formatearTamano(maxBytes)}.`;
  }
  return null;
}

export function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

@Component({
  selector: 'app-file-upload',
  standalone: true,
  templateUrl: './file-upload.html',
  styleUrl: './file-upload.scss',
})
export class FileUpload {
  /** Archivo elegido (enlazable con [(archivo)]); null si no hay o no pasó la validación. */
  readonly archivo = model<File | null>(null);
  /** Extensiones permitidas, con punto (ej. ['.csv']). */
  readonly extensiones = input<readonly string[]>([]);
  readonly maxBytes = input(15 * 1024 * 1024);
  readonly etiqueta = input('Arrastra un archivo aquí o haz clic para elegirlo');
  readonly deshabilitado = input(false);

  protected readonly arrastrando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly entrada = viewChild<ElementRef<HTMLInputElement>>('entrada');
  protected readonly idEntrada = `file-upload-${++siguienteId}`;
  protected readonly accept = computed(() => this.extensiones().join(','));
  protected readonly ayuda = computed(
    () => `${this.extensiones().join(', ')} · máx. ${formatearTamano(this.maxBytes())}`,
  );
  protected readonly tamano = computed(() => formatearTamano(this.archivo()?.size ?? 0));

  alElegir(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    this.procesar(entrada.files?.[0] ?? null);
  }

  alSoltar(evento: DragEvent): void {
    evento.preventDefault();
    this.arrastrando.set(false);
    if (this.deshabilitado()) return;
    this.procesar(evento.dataTransfer?.files?.[0] ?? null);
  }

  alArrastrar(evento: DragEvent): void {
    evento.preventDefault();
    if (!this.deshabilitado()) this.arrastrando.set(true);
  }

  abrir(): void {
    const nativa = this.entrada()?.nativeElement;
    if (this.deshabilitado() || !nativa) return;
    // Permite volver a elegir el mismo archivo tras limpiarlo o cargarlo.
    nativa.value = '';
    nativa.click();
  }

  alTeclado(evento: KeyboardEvent): void {
    if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault();
      this.abrir();
    }
  }

  limpiar(): void {
    this.error.set(null);
    this.archivo.set(null);
    const nativa = this.entrada()?.nativeElement;
    if (nativa) nativa.value = '';
  }

  procesar(archivo: File | null): void {
    if (!archivo) {
      this.limpiar();
      return;
    }
    const mensaje = validarArchivo(archivo, this.extensiones(), this.maxBytes());
    if (mensaje) {
      this.limpiar();
      this.error.set(mensaje);
      return;
    }
    this.error.set(null);
    this.archivo.set(archivo);
  }
}
