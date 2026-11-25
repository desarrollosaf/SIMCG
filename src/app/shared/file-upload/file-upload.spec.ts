import { TestBed } from '@angular/core/testing';
import { FileUpload, validarArchivo } from './file-upload';

const archivo = (nombre: string, bytes = 10) =>
  new File([new Uint8Array(bytes)], nombre, { type: 'application/octet-stream' });

describe('validarArchivo', () => {
  it('acepta extensiones permitidas sin importar mayúsculas', () => {
    expect(validarArchivo(archivo('ACTA.PDF'), ['.pdf', '.tif'], 100)).toBeNull();
    expect(validarArchivo(archivo('scan.tiff'), ['.pdf', '.tif', '.tiff'], 100)).toBeNull();
  });

  it('rechaza extensiones no permitidas', () => {
    expect(validarArchivo(archivo('datos.xlsx'), ['.pdf'], 100)).toContain('Formato no permitido');
  });

  it('rechaza archivos que superan el tamaño máximo', () => {
    expect(validarArchivo(archivo('a.pdf', 200), ['.pdf'], 100)).toContain('máximo');
  });
});

describe('FileUpload', () => {
  const crear = (extensiones: string[], maxBytes: number) => {
    const fixture = TestBed.createComponent(FileUpload);
    fixture.componentRef.setInput('extensiones', extensiones);
    fixture.componentRef.setInput('maxBytes', maxBytes);
    fixture.detectChanges();
    return fixture;
  };

  it('emite el archivo válido', () => {
    const fixture = crear(['.csv'], 100);
    const emitido = vi.fn();
    fixture.componentInstance.archivo.subscribe(emitido);
    const f = archivo('datos.csv');
    fixture.componentInstance.procesar(f);
    expect(fixture.componentInstance.archivo()).toBe(f);
    expect(emitido).toHaveBeenCalledWith(f);
  });

  it('no emite un archivo inválido y muestra el error', () => {
    const fixture = crear(['.csv'], 100);
    fixture.componentInstance.procesar(archivo('datos.pdf'));
    fixture.detectChanges();
    expect(fixture.componentInstance.archivo()).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('limpiar vuelve a null', () => {
    const fixture = crear(['.csv'], 100);
    fixture.componentInstance.procesar(archivo('datos.csv'));
    fixture.componentInstance.limpiar();
    expect(fixture.componentInstance.archivo()).toBeNull();
  });

  it('la zona es accesible con teclado y se deshabilita', () => {
    const fixture = crear(['.csv'], 100);
    const zona = fixture.nativeElement.querySelector('[role="button"]') as HTMLElement;
    expect(zona.getAttribute('tabindex')).toBe('0');
    fixture.componentRef.setInput('deshabilitado', true);
    fixture.detectChanges();
    expect(zona.getAttribute('tabindex')).toBe('-1');
  });
});
