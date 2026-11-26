import { PlantillasService } from './plantillas.service';

describe('PlantillasService', () => {
  let servicio: PlantillasService;

  beforeEach(() => {
    servicio = new PlantillasService();
  });

  it('interpola {{ clave }} escapando HTML', () => {
    jest
      .spyOn(servicio, 'cargar')
      .mockReturnValue('<p>{{ nombre }}</p><i>{{falta}}</i>');
    const html = servicio.renderizar('x', {
      nombre: `<b>"Ana" & 'Luis'</b>`,
    });
    expect(html).toBe(
      '<p>&lt;b&gt;&quot;Ana&quot; &amp; &#39;Luis&#39;&lt;/b&gt;</p><i></i>',
    );
  });

  it('{{{ clave }}} inserta el fragmento sin escapar', () => {
    jest.spyOn(servicio, 'cargar').mockReturnValue('<div>{{{ cuerpo }}}</div>');
    expect(servicio.renderizar('x', { cuerpo: '<b>hola</b>' })).toBe(
      '<div><b>hola</b></div>',
    );
  });

  it('renderiza la plantilla base de carta', () => {
    const html = servicio.renderizar('_base-carta', {
      contenido: '<p>Oficio</p>',
    });
    expect(html).toContain('<p>Oficio</p>');
    expect(html).toContain('size: letter');
  });

  it('rechaza nombres de plantilla con rutas', () => {
    expect(() => servicio.cargar('../app')).toThrow();
  });

  it('imagenBase64 devuelve data URI y bloquea rutas fuera de assets', () => {
    expect(servicio.imagenBase64('encabezado.jpg')).toMatch(
      /^data:image\/jpeg;base64,/,
    );
    expect(() => servicio.imagenBase64('../../app.module.ts')).toThrow();
  });
});
