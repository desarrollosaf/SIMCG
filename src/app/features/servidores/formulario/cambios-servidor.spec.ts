import { calcularCambios, normalizarValor, SIN_VALOR } from './cambios-servidor';

describe('cambios-servidor', () => {
  it('normalizarValor trata null, undefined y espacios como vacío', () => {
    expect(normalizarValor(null)).toBe('');
    expect(normalizarValor(undefined)).toBe('');
    expect(normalizarValor('  X ')).toBe('X');
    expect(normalizarValor(3)).toBe('3');
  });

  it('sin diferencias no devuelve cambios', () => {
    expect(
      calcularCambios({ cargo: 'A', segundoApellido: null }, { cargo: ' A ', segundoApellido: '' }),
    ).toEqual([]);
  });

  it('devuelve etiqueta, antes y después en el orden del formulario', () => {
    const cambios = calcularCambios(
      { nombre: 'ANA', rfc: 'AAAA010101' },
      { nombre: 'LUIS', rfc: 'BBBB010101' },
    );
    expect(cambios.map((c) => c.campo)).toEqual(['rfc', 'nombre']);
    expect(cambios[1]).toEqual({
      campo: 'nombre',
      etiqueta: 'Nombre(s)',
      antes: 'ANA',
      despues: 'LUIS',
    });
  });

  it('muestra (vacío) cuando se agrega o se quita un valor', () => {
    const [agrega] = calcularCambios({ cveIssemym: null }, { cveIssemym: '1234567' });
    expect(agrega.antes).toBe(SIN_VALOR);
    const [quita] = calcularCambios({ cveIssemym: '1234567' }, { cveIssemym: '' });
    expect(quita.despues).toBe(SIN_VALOR);
  });

  it('usa nombrar para convertir ids de catálogo en texto', () => {
    const [c] = calcularCambios(
      { tipoDependenciaId: 1 },
      { tipoDependenciaId: 2 },
      (campo, valor) => (campo === 'tipoDependenciaId' ? `DEP ${valor}` : valor),
    );
    expect(c).toMatchObject({ antes: 'DEP 1', despues: 'DEP 2' });
  });

  it('ignora los campos que no se están comparando (correo sin desbloquear)', () => {
    expect(calcularCambios({ email: 'a@x.com' }, {})).toEqual([]);
  });
});
