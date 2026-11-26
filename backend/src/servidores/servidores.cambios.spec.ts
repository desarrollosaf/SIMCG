import { calcularCambios, normalizar } from './servidores.cambios';

describe('servidores.cambios', () => {
  it('normalizar recorta y trata vacío como null', () => {
    expect(normalizar('  ANA ')).toBe('ANA');
    expect(normalizar('')).toBeNull();
    expect(normalizar('   ')).toBeNull();
    expect(normalizar(undefined)).toBeNull();
    expect(normalizar(7)).toBe('7');
  });

  it('no reporta cambios cuando solo difieren espacios, null y vacío', () => {
    const cambios = calcularCambios(
      { cargo: ' JEFA ', segundoApellido: null, tipoDireccionId: 7 },
      { cargo: 'JEFA', segundoApellido: '', tipoDireccionId: '7' },
    );
    expect(cambios).toEqual([]);
  });

  it('lista los cambios en el orden del formulario con su etiqueta', () => {
    const cambios = calcularCambios(
      { cargo: 'JEFA', rfc: 'AAAA010101', email: 'a@x.com' },
      { email: 'b@x.com', cargo: 'ANALISTA', rfc: 'AAAA010101' },
    );
    expect(cambios).toEqual([
      {
        campo: 'cargo',
        etiqueta: 'Nombre del empleo, cargo o comisión',
        antes: 'JEFA',
        despues: 'ANALISTA',
      },
      {
        campo: 'email',
        etiqueta: 'Correo',
        antes: 'a@x.com',
        despues: 'b@x.com',
      },
    ]);
  });

  it('ignora los campos que no vienen en la petición (p. ej. correo)', () => {
    expect(
      calcularCambios({ email: 'a@x.com', cargo: 'X' }, { cargo: 'X' }),
    ).toEqual([]);
    expect(calcularCambios({ email: 'a@x.com' }, { email: undefined })).toEqual(
      [],
    );
  });

  it('detecta que se quitó un valor', () => {
    expect(
      calcularCambios({ cveIssemym: '1234567' }, { cveIssemym: null }),
    ).toMatchObject([{ campo: 'cveIssemym', antes: '1234567', despues: null }]);
  });
});
