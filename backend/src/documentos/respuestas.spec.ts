import { respuestaExcel, respuestaPdf } from './respuestas';

describe('respuestas', () => {
  it('respuestaPdf es inline por omisión y adjunto si se pide', () => {
    const r = respuestaPdf(Buffer.from('%PDF'), 'Oficio.pdf');
    expect(r.getHeaders().type).toBe('application/pdf');
    expect(r.getHeaders().disposition).toMatch(/^inline;/);
    const adjunto = respuestaPdf(Buffer.from('x'), 'a.pdf', false);
    expect(adjunto.getHeaders().disposition).toMatch(/^attachment;/);
  });

  it('respuestaExcel es adjunto xlsx', () => {
    const h = respuestaExcel(Buffer.from('x'), 'Omisos.xlsx').getHeaders();
    expect(h.type).toContain('spreadsheetml.sheet');
    expect(h.disposition).toMatch(/^attachment;/);
  });
});
