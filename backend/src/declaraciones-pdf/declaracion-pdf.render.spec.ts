import { readFileSync } from 'fs';
import * as path from 'path';
import { compilarBlade, renderizarNodos } from './blade/blade';
import { Coleccion, Modelo } from './blade/valores';
import {
  armarAclaraciones,
  CLAVES_SOLO_COMPLETA,
  SECCIONES_ACLARACION,
} from './aclaraciones';
import type { VistaDeclaracion } from './declaracion-pdf.service';
import { CATALOGO } from './eloquent/catalogo';
import { textoPlano } from './blade/php';

// Estos specs generan el HTML de cada vista (sin Chromium) para una declaración de
// ejemplo y comprueban títulos, encabezados de columnas y leyendas tal como están en
// las vistas del sistema anterior.

type Rels = Record<string, unknown>;

const modelo = (
  clase: string,
  atributos: Record<string, unknown>,
  rels: Rels = {},
) => {
  const m = new Modelo(clase, atributos);
  for (const [k, v] of Object.entries(rels))
    m.relaciones.set(k.toLowerCase(), v);
  return m;
};
const cat = (valor: string) => modelo('Cat', { valor });
const lista = (...items: Modelo[]) => Coleccion.from(items);

function servidor() {
  return modelo(
    'ServidorPublico',
    {
      nombre: 'sergio adrian',
      primer_apellido: 'garcia',
      segundo_apellido: 'robles',
      curp: 'GARS631121HMCRBR04',
      rfc: 'GARS631121',
      homoclave: 'ab6',
      cargo: 'ASESOR C',
      honorarios: 2,
    },
    {
      nombreDependencia: modelo('tipoDependencia', { nombre: 'LEGISLATURA' }),
      nombreDireccion: modelo('tipoDireccion', { nombre: 'DIRECCION X' }),
      nombreDepartamento: modelo('tipoDepartamento', { nombre: 'DEPTO Y' }),
    },
  );
}

function declaracion(tipo: number, extra: Rels = {}, attrs = {}) {
  const base = modelo(
    'Declaracion',
    {
      id: 123,
      tipo_movimiento_id: tipo,
      situacion_personal_id: 2,
      correo_institucional: 'a@x.gob.mx',
      correo_personal: 'p@gmail.com',
      telefono_casa: '7220000000',
      telefono_personal: '7221111111',
      fecha_declaracion: '2024-03-09',
      fecha_envio: '2024-03-12',
      hora_envio: '10:30:00',
      fecha_envio_aclaracion: null,
      observaciones: 'OBSERVACION GENERAL',
      nivel_cargo: '32-1',
      ...attrs,
    },
    {
      tipo_movimiento: modelo('TipoMovimientoMCG', {
        valor: [
          '',
          'INICIAL',
          'INICIAL',
          'MODIFICACION',
          'CONCLUSION',
          'INTERESES',
        ][tipo],
      }),
      estatus_declaracion: modelo('EstatusDeclaracion', { estatus: 'Enviada' }),
      servidor_publico: servidor(),
      situacion_personal: cat('CASADO (A)'),
      pais: cat('México'),
      nacionalidades: cat('MEXICANA'),
      domicilio: modelo(
        'Domicilio',
        {
          calle: 'AV ESTADO DE MEXICO',
          num_ext: '531',
          num_int: '40',
          colonia: 'FRACC ALAMOS I',
          codigo_postal: '52140',
        },
        {
          entidad_domicilio: modelo('Entidad', { entidad: 'méxico' }),
          municipio_domicilio: modelo('Municipio', { municipio: 'metepec' }),
        },
      ),
      datos_curriculares: lista(
        modelo(
          'DatoCurricular',
          {
            carrera_area: 'ADMINISTRACION',
            institucion_educativa: 'UAEM',
            fecha_documento: '1990-01-01',
            observaciones: 'OBS CURRICULAR',
          },
          {
            nivel: cat('LICENCIATURA'),
            estatus: cat('FINALIZADO'),
            documento: cat('TITULO'),
          },
        ),
      ),
      datos_empleo_declarante: modelo(
        'DatoEmpleoDeclarante',
        {
          funcion_principal: 'FUNCION PRINCIPAL X',
          telefono_oficina: '7222796400',
          extension: '7471',
          calle: 'MARIANO MATAMOROS',
          numero_exterior: '106',
          numero_interior_piso: '03',
          colonia_localidad: 'CENTRO',
          codigo_postal: '50000',
        },
        {
          entidades: modelo('Entidad', { entidad: 'MEXICO' }),
          municipios: modelo('Municipio', { municipio: 'TOLUCA' }),
        },
      ),
      ...extra,
    },
  );
  return base;
}

function ingresos() {
  return modelo('IngresoNeto', {
    ingreso_mensual_publico: '12345.6',
    ingreso_mensual_neto: '12345.6',
    ingreso_mensual_neto_pareja: '0',
    total_ingresos_declarante_pareja: '12345.6',
    ingreso_mensual_suma: '0',
    aclaraciones_observaciones: 'OBS INGRESOS',
  });
}

function inmueble() {
  return modelo(
    'BienInmueble',
    {
      porcentaje_propiedad: '100%',
      superficie_terreno: '714 M2',
      superficie_construccion: '420 M2',
      valor_adquisicion: '600000',
      fecha_adquisicion: '1995-01-01',
      registro: 'FOLIO REAL 1',
      observaciones: 'OBS INMUEBLE',
    },
    {
      tipoInmueble: cat('CASA'),
      titular: cat('DECLARANTE'),
      formaAdquisicion: cat('DONACION'),
      valorConforme: cat('CONTRATO'),
      tipoMoneda: cat('PESO MEXICANO'),
      ubicacionInmueble: cat('MÉXICO'),
      domicilio: modelo(
        'Domicilio',
        {
          calle: 'CORREDORES',
          num_ext: 'S/N',
          colonia: 'CACALOMACAN',
          codigo_postal: '50265',
        },
        {
          entidad_domicilio: modelo('Entidad', { entidad: 'MEXICO' }),
          municipio_domicilio: modelo('Municipio', { municipio: 'TOLUCA' }),
        },
      ),
    },
  );
}

const RAIZ = path.join(__dirname, '..', 'plantillas', 'declaracion');
const compiladas = new Map<
  VistaDeclaracion,
  ReturnType<typeof compilarBlade>
>();

function render(
  vista: VistaDeclaracion,
  decl: Modelo,
  opciones: {
    aclaraciones?: Record<string, string | null>;
    intereses?: boolean;
  } = {},
): string {
  let nodos = compiladas.get(vista);
  if (!nodos) {
    nodos = compilarBlade(
      readFileSync(path.join(RAIZ, `${vista}.blade.html`), 'utf8'),
    );
    compiladas.set(vista, nodos);
  }
  const aclaraciones = opciones.aclaraciones ?? {};
  for (const s of SECCIONES_ACLARACION) aclaraciones[s.clave] ??= null;
  return renderizarNodos(nodos, {
    vars: {
      declaracion: decl,
      servidor: servidor(),
      aclaraciones,
      estatus: ' - Declaración entregada.',
      estatusAclaracion: decl.atributos['fecha_envio_aclaracion']
        ? ' - Aclaración entregada.'
        : ' - Aclaración pendiente de entregar.',
    },
    sesion: { intereses: opciones.intereses ?? false },
  });
}

const texto = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');

describe('vista pública completa (index) — movimiento inicial', () => {
  const html = render(
    'index',
    declaracion(1, {
      ingresos: ingresos(),
      bienes_inmuebles: lista(inmueble()),
    }),
  );
  const t = texto(html);

  it('trae el preámbulo legal con la fracción y el tipo de declaración', () => {
    expect(t).toContain('CONTRALOR DEL PODER LEGISLATIVO DEL ESTADO DE MÉXICO');
    expect(t).toContain(
      '32, 33, 34 fracción I , 35, 39, 40, 44, 45, 46 y 50 fracción IV',
    );
    expect(t).toContain('presento mi Declaración INICIAL ,');
    expect(t).toContain('DECLARACIÓN DE SITUACIÓN PATRIMONIAL');
  });

  it('numera los apartados con su folio y estatus', () => {
    expect(t).toContain(
      'DATOS GENERALES DEL DECLARANTE Folio: 0000000123 - Declaración entregada.',
    );
    expect(t).toContain('DOMICILIO DEL DECLARANTE Folio: 0000000123');
    expect(t).toContain('DATOS CURRICULARES DEL DECLARANTE');
    expect(t).toContain('DATOS DEL EMPLEO, CARGO O COMISIÓN QUE INICIA');
    expect(t).toContain('EXPERIENCIA LABORAL');
    expect(t).toContain('DATOS DE LA PAREJA');
    expect(t).toContain('DATOS DEL DEPENDIENTE ECONÓMICO');
    expect(t).toContain('COMPROBANTE DE DECLARACIÓN FISCAL');
    expect(t).toContain('BIENES INMUEBLES (A LA FECHA DE INGRESO)');
    expect(t).toContain('VEHÍCULOS (A LA FECHA DE INGRESO)');
    expect(t).toContain('ADEUDOS / PASIVOS');
    expect(t).toContain('PRÉSTAMO O COMODATO POR TERCEROS');
    expect(t).toContain(
      'INGRESOS NETOS DEL DECLARANTE, PAREJA Y/O DEPENDIENTES ECONÓMICOS (SITUACIÓN ACTUAL)',
    );
  });

  it('copia los encabezados de columna literales de los datos generales', () => {
    for (const th of [
      'Nombre (s):',
      'Primer Apellido:',
      'Segundo Apellido:',
      'CURP:',
      'RFC:',
      'Homoclave:',
      'Correo institucional:',
      'Correo personal:',
      'Núm. telefónico de casa:',
      'Núm. celular personal:',
      'Estado Civil / Situación personal:',
      'Régimen matrimonial:',
      'País de nacimiento:',
      'Nacionalidad:',
      'Aclaraciones / Observaciones:',
    ]) {
      expect(html).toContain(`>${th}</th>`);
    }
    // En un movimiento inicial no se pregunta por el servidor público del año anterior.
    expect(t).not.toContain(
      '¿Te desempeñaste como servidor público el año inmediato anterior?',
    );
  });

  it('muestra los datos del servidor en mayúsculas y los del declarante tal cual', () => {
    expect(html).toContain('<td>SERGIO ADRIAN</td>');
    expect(html).toContain('<td>GARCIA</td>');
    expect(html).toContain('<td>AB6</td>');
    expect(html).toContain('GARS631121HMCRBR04');
    expect(t).toContain('METEPEC');
    expect(t).toContain('MÉXICO');
  });

  it('el empleo trae los valores fijos del Poder Legislativo y el teléfono con extensión', () => {
    expect(html).toContain('<td>ESTATAL</td>');
    expect(html).toContain('<td>LEGISLATIVO</td>');
    expect(html).toContain('<td>PODER LEGISLATIVO DEL ESTADO DE MÉXICO</td>');
    expect(t).toContain('7222796400 Ext. 7471');
    expect(t).toContain('ASESOR C');
  });

  it('formatea los importes con signo de pesos y dos decimales', () => {
    expect(t).toContain('$12,345.60');
    expect(t).toContain('$600,000.00');
  });

  it('los apartados sin registros dicen "No se registró información en este apartado"', () => {
    expect(t).toContain('No se registró información en este apartado');
    const veh = t.slice(t.indexOf('VEHÍCULOS'), t.indexOf('BIENES MUEBLES'));
    expect(veh).toContain('No se registró información en este apartado');
  });

  it('incluye la declaración de intereses y el cierre con la cadena original', () => {
    expect(t).toContain('DECLARACIÓN DE INTERESES');
    expect(t).toContain('PROTESTO LO NECESARIO');
    expect(t).toContain(
      'Por el presente se hace constar que SERGIO ADRIAN GARCIA ROBLES',
    );
    expect(t).toContain('34 fracci&oacute;n I ;');
    expect(t).toContain(
      'su Declaración de Situación Patrimonial y de Intereses INICIAL ,',
    );
    expect(t).toContain(
      '|| INICIAL:123 | FOLIO:0000000123 | RFC:GARS631121 | PRIMER APELLIDO:garcia',
    );
    expect(t).toContain('FECHA DEL MOVIMIENTO: 09-03-2024');
    expect(t).toContain('FECHA DE ENTREGA: 12-03-2024');
    expect(t).toContain('INGRESO MENSUAL DECLARANTE: $ 12,345.60');
    expect(t).toContain('DEPENDENCIA:LEGISLATURA');
  });

  it('sin aclaración enviada no imprime la sección ACLARACIONES', () => {
    expect(html).not.toContain('<h1 align="center">ACLARACIONES</h1>');
  });
});

describe('variantes por tipo de movimiento', () => {
  it('modificación: fracción II, "por MODIFICACIÓN", rango del año anterior y sin pregunta de servidor anterior', () => {
    const html = render(
      'index',
      declaracion(3, {
        ingresos: ingresos(),
        bienes_inmuebles: lista(inmueble()),
      }),
    );
    const t = texto(html);
    expect(t).toContain('34 fracción II ,');
    expect(t).toContain('por MODIFICACIÓN ,');
    expect(t).toContain(
      'BIENES INMUEBLES (ENTRE EL 1 DE ENERO Y EL 31 DE DICIEMBRE DEL AÑO INMEDIATO ANTERIOR)',
    );
    expect(t).toContain(
      'INGRESOS NETOS DEL DECLARANTE, PAREJA Y/O DEPENDIENTES ECONÓMICOS (ENTRE EL 1 DE ENERO AL 31 DE DICIEMBRE DEL AÑO INMEDIATO ANTERIOR)',
    );
    expect(t).toContain('DATOS DEL EMPLEO, CARGO O COMISIÓN Folio');
    expect(t).toContain(
      '¿Te desempeñaste como servidor público el año inmediato anterior?',
    );
    expect(t).not.toContain(
      '¿TE DESEMPEÑASTE COMO SERVIDOR PÚBLICO EN EL AÑO INMEDIATO ANTERIOR?',
    );
    expect(t).toContain('INGRESO ANUAL DECLARANTE: $ 12,345.60');
  });

  it('conclusión: fracción III, "por CONCLUSIÓN", empleo que concluye y situación actual', () => {
    const t = texto(
      render(
        'index',
        declaracion(4, {
          ingresos: ingresos(),
          bienes_inmuebles: lista(inmueble()),
        }),
      ),
    );
    expect(t).toContain('34 fracción III ,');
    expect(t).toContain('por CONCLUSIÓN ,');
    expect(t).toContain('DATOS DEL EMPLEO, CARGO O COMISIÓN QUE CONCLUYE');
    expect(t).toContain('BIENES INMUEBLES (SITUACIÓN ACTUAL)');
    expect(t).toContain(
      '¿TE DESEMPEÑASTE COMO SERVIDOR PÚBLICO EN EL AÑO INMEDIATO ANTERIOR?',
    );
    expect(t).toContain('|| CONCLUSION:123 |');
  });

  it('intereses (tipo 5): sin el bloque patrimonial y con el texto de intereses', () => {
    const decl = declaracion(5, {
      folioIntereses: modelo('FoliosIntereses', { folio: 77 }),
    });
    const t = texto(render('index', decl, { intereses: true }));
    expect(t).toContain('presento mi Declaración de INTERESES');
    expect(t).toContain(
      '7 fracciones II, y IX; 9 fracción IX; 10 párrafo segundo; 32, 33, 46,',
    );
    expect(t).not.toContain('DECLARACIÓN DE SITUACIÓN PATRIMONIAL');
    expect(t).not.toContain('DATOS GENERALES DEL DECLARANTE');
    expect(t).not.toContain('BIENES INMUEBLES');
    expect(t).toContain('DECLARACIÓN DE INTERESES');
    expect(t).toContain(
      'su Declaración de Situación Patrimonial y de Intereses por INTERESES.',
    );
    expect(t).toContain('|| INTERESES: 77-D.INT. | FOLIO: 0000000077-D.INT.');
  });
});

describe('vista reducida (nivel bajo)', () => {
  it('no imprime bienes, vehículos, inversiones, adeudos ni préstamos', () => {
    const decl = declaracion(1, {
      ingresos: ingresos(),
      bienes_inmuebles: lista(inmueble()),
    });
    const completa = texto(render('index', decl));
    const reducida = texto(render('indexc', decl));
    for (const titulo of [
      'BIENES INMUEBLES (A LA FECHA DE INGRESO)',
      'VEHÍCULOS (A LA FECHA DE INGRESO)',
      'BIENES MUEBLES',
      'INVERSIONES, CUENTAS BANCARIAS Y OTRO TIPO DE VALORES / ACTIVOS',
      'ADEUDOS / PASIVOS',
      'PRÉSTAMO O COMODATO POR TERCEROS',
    ]) {
      expect(completa).toContain(titulo);
      expect(reducida).not.toContain(titulo);
    }
    expect(reducida).toContain(
      'INGRESOS NETOS DEL DECLARANTE, PAREJA Y/O DEPENDIENTES ECONÓMICOS',
    );
    expect(reducida).toContain('DECLARACIÓN DE INTERESES');
  });

  it('las claves que no aplican a la reducida son las seis de bienes y pasivos', () => {
    expect(CLAVES_SOLO_COMPLETA).toEqual([
      'BIENES INMUEBLES',
      'VEHICULOS',
      'BIENES MUEBLES',
      'INVERSIONES, CUENTAS BANCARIAS',
      'ADEDUOS / PASIVOS',
      'PRESTAMO O COMODATOS A TERCEROS',
    ]);
  });
});

describe('versión privada', () => {
  const decl = () =>
    declaracion(1, {
      ingresos: ingresos(),
      bienes_inmuebles: lista(inmueble()),
    });

  it('oculta con CONFIDENCIAL lo que la pública muestra', () => {
    const publica = render('index', decl());
    const privada = render('indexp', decl());
    expect(publica).toContain('GARS631121HMCRBR04');
    expect(publica).toContain('p@gmail.com');
    expect(publica).not.toContain('CONFIDENCIAL');
    expect(privada).not.toContain('GARS631121HMCRBR04');
    expect(privada).not.toContain('p@gmail.com');
    expect(privada).not.toContain('AV ESTADO DE MEXICO');
    expect(texto(privada)).toContain('CONFIDENCIAL');
    // El correo institucional y el nombre siguen visibles en la privada.
    expect(privada).toContain('a@x.gob.mx');
    expect(privada).toContain('SERGIO ADRIAN');
  });

  it('conserva los mismos apartados y encabezados', () => {
    const t = texto(render('indexp', decl()));
    expect(t).toContain('DATOS GENERALES DEL DECLARANTE');
    expect(t).toContain('BIENES INMUEBLES (A LA FECHA DE INGRESO)');
    expect(t).toContain('Primer Apellido:');
  });

  it('la reducida privada tampoco imprime bienes ni pasivos', () => {
    const t = texto(render('indexcp', decl()));
    expect(t).not.toContain('BIENES INMUEBLES (A LA FECHA DE INGRESO)');
    expect(t).toContain('INGRESOS NETOS DEL DECLARANTE');
  });
});

describe('aclaraciones', () => {
  const conAclaracion = () =>
    declaracion(
      3,
      { ingresos: ingresos() },
      { fecha_envio_aclaracion: '2024-04-01' },
    );

  it('con fecha de envío de aclaración imprime el apartado con el texto del artículo 27', () => {
    const html = render('index', conAclaracion(), {
      aclaraciones: {
        'INGRESOS NETOS': 'ACLARO MIS INGRESOS',
        'DATOS CURRICULARES': 'ACLARO ESTUDIOS',
      },
    });
    const t = texto(html);
    expect(html).toContain('<h1 align="center">ACLARACIONES</h1>');
    expect(t).toContain('Con fundamento en el artículo 27 de los Lineamientos');
    expect(t).toContain('ACLARO MIS INGRESOS');
    expect(t).toContain('ACLARO ESTUDIOS');
    expect(t).toContain('Observaciones');
    expect(t).toContain('Folio: 0000000123 - Aclaración entregada.');
  });

  it('las secciones sin aclaración dicen que no se registró información', () => {
    const t = texto(render('index', conAclaracion(), { aclaraciones: {} }));
    const parte = t.slice(t.indexOf('Con fundamento'));
    expect(parte).toContain('No se registró información en este apartado');
    expect(parte).toContain('DATOS GENERALES DEL DECLARANTE');
    expect(parte).toContain('DECLARACIÓN DE INTERESES');
  });

  it('la reducida no tiene bloques de aclaración de bienes, vehículos ni pasivos', () => {
    const aclaraciones = Object.fromEntries(
      SECCIONES_ACLARACION.map((s) => [s.clave, `ACL ${s.clave}`]),
    );
    for (const clave of CLAVES_SOLO_COMPLETA) delete aclaraciones[clave];
    const t = texto(render('indexc', conAclaracion(), { aclaraciones }));
    expect(t).toContain('ACL INGRESOS NETOS');
    expect(t).not.toContain('ACL BIENES INMUEBLES');
    expect(t).not.toContain('ACL VEHICULOS');
  });
});

describe('armarAclaraciones', () => {
  const sinRespaldo = new Map<string, string | null>();
  const acl = (obs: string | null) =>
    modelo('Aclaraciones', { observaciones: obs });
  const base = (rels: Rels, attrs = {}) =>
    modelo(
      'Declaracion',
      { id: 9, tipo_movimiento_id: 1, situacion_personal_id: 1, ...attrs },
      rels,
    );

  it('arranca con las 27 claves vacías en el orden del sistema anterior', () => {
    const a = armarAclaraciones(base({}), sinRespaldo);
    expect(Object.keys(a)).toHaveLength(27);
    expect(Object.keys(a)[0]).toBe('DATOS GENERALES');
    expect(Object.keys(a)[26]).toBe('VIAJES');
    expect(Object.values(a).every((v) => v === null)).toBe(true);
  });

  it('toma la aclaración del primer registro de cada relación', () => {
    const a = armarAclaraciones(
      base({
        bienes_inmuebles: lista(
          modelo('BienInmueble', {}, { aclaracionesDecl: acl('PRIMERA') }),
          modelo('BienInmueble', {}, { aclaracionesDecl: acl('SEGUNDA') }),
        ),
        ingresos: modelo('IngresoNeto', {}, { aclaracionesDecl: acl('ING') }),
      }),
      sinRespaldo,
    );
    expect(a['BIENES INMUEBLES']).toBe('PRIMERA');
    expect(a['INGRESOS NETOS']).toBe('ING');
  });

  it('DATOS GENERALES y DOMICILIO DECLARANTE nunca traen texto (no existe esa relación)', () => {
    const a = armarAclaraciones(
      base({ domicilio: modelo('Domicilio', {}) }),
      sinRespaldo,
    );
    expect(a['DATOS GENERALES']).toBeNull();
    expect(a['DOMICILIO DECLARANTE']).toBeNull();
  });

  it('si el primer registro no tiene aclaración usa la ligada al id de la declaración', () => {
    const respaldo = new Map<string, string | null>([
      ['App\\Vehiculo', 'RESPALDO'],
    ]);
    const a = armarAclaraciones(
      base({
        vehiculos: lista(modelo('Vehiculo', {}, { aclaracionesDecl: null })),
      }),
      respaldo,
    );
    expect(a['VEHICULOS']).toBe('RESPALDO');
    expect(a['VIAJES']).toBeNull();
  });

  it('la pareja solo cuenta con situación personal 2, 5 o 6', () => {
    const pareja = modelo('DatosPareja', {}, { aclaracionesDecl: acl('PAR') });
    expect(
      armarAclaraciones(
        base({ pareja }, { situacion_personal_id: 1 }),
        sinRespaldo,
      )['DATOS DE LA PAREJA'],
    ).toBeNull();
    for (const sp of [2, 5, 6]) {
      expect(
        armarAclaraciones(
          base({ pareja }, { situacion_personal_id: sp }),
          sinRespaldo,
        )['DATOS DE LA PAREJA'],
      ).toBe('PAR');
    }
  });

  it('el servidor público anterior no aplica en modificaciones (tipo 3)', () => {
    const fue = modelo(
      'FueServidorPublico',
      {},
      { aclaracionesDecl: acl('FUE') },
    );
    expect(
      armarAclaraciones(
        base({ fueServidorPublico: fue }, { tipo_movimiento_id: 3 }),
        sinRespaldo,
      )['TE DESEMPENASTE COMO SERVIDOR PUBLICO'],
    ).toBeNull();
    expect(
      armarAclaraciones(
        base({ fueServidorPublico: fue }, { tipo_movimiento_id: 4 }),
        sinRespaldo,
      )['TE DESEMPENASTE COMO SERVIDOR PUBLICO'],
    ).toBe('FUE');
  });

  it('declaración fiscal con observación vacía lleva el texto fijo', () => {
    const sat = (obs: string | null) =>
      modelo('DocumentoSat', {}, { aclaracionesDecl: acl(obs) });
    expect(
      armarAclaraciones(base({ documentoSat: sat('') }), sinRespaldo)[
        'DECLARACION FISCAL'
      ],
    ).toBe(
      'NO REALIZO MANIFESTACION ALGUNA, NO OBSTANTE SUBIO UN ARCHIVO EN PDF.',
    );
    expect(
      armarAclaraciones(base({ documentoSat: sat(null) }), sinRespaldo)[
        'DECLARACION FISCAL'
      ],
    ).toBe(
      'NO REALIZO MANIFESTACION ALGUNA, NO OBSTANTE SUBIO UN ARCHIVO EN PDF.',
    );
    expect(
      armarAclaraciones(base({ documentoSat: sat('TEXTO') }), sinRespaldo)[
        'DECLARACION FISCAL'
      ],
    ).toBe('TEXTO');
  });
});

// Correcciones aprobadas sobre errores del sistema anterior: cada una cambia solo
// el texto que se indica.
describe('correcciones de errores del sistema anterior', () => {
  const acl = (obs: string | null) =>
    modelo('Aclaraciones', { observaciones: obs });
  const base = (rels: Rels, attrs = {}) =>
    modelo(
      'Declaracion',
      { id: 9, tipo_movimiento_id: 1, situacion_personal_id: 1, ...attrs },
      rels,
    );
  const sinRespaldo = new Map<string, string | null>();

  it('1. las aclaraciones de DATOS GENERALES y DOMICILIO salen de su propia aclaración', () => {
    const a = armarAclaraciones(
      base({
        aclaraciones: acl('ACL GENERALES'),
        domicilio: modelo(
          'Domicilio',
          {},
          { aclaraciones: acl('ACL DOMICILIO') },
        ),
      }),
      sinRespaldo,
    );
    expect(a['DATOS GENERALES']).toBe('ACL GENERALES');
    expect(a['DOMICILIO DECLARANTE']).toBe('ACL DOMICILIO');
    const t = texto(
      render(
        'index',
        declaracion(1, {}, { fecha_envio_aclaracion: '2024-04-01' }),
        { aclaraciones: a },
      ),
    );
    expect(t).toContain('ACL GENERALES');
    expect(t).toContain('ACL DOMICILIO');
  });

  it('1. el catálogo sabe leer esas aclaraciones por su tipo', () => {
    expect(CATALOGO['Declaracion'].relaciones['aclaraciones']).toMatchObject({
      tipoValor: 'App\\Declaracion',
      claveDestino: 'aclaracionable_id',
    });
    expect(CATALOGO['Domicilio'].relaciones['aclaraciones'].tipoValor).toBe(
      'App\\Domicilio',
    );
  });

  it('2. toma la aclaración del primer registro que la tenga, no solo del primero', () => {
    const a = armarAclaraciones(
      base({
        vehiculos: lista(
          modelo('Vehiculo', {}, { aclaracionesDecl: null }),
          modelo('Vehiculo', {}, { aclaracionesDecl: acl('DEL SEGUNDO') }),
        ),
      }),
      sinRespaldo,
    );
    expect(a['VEHICULOS']).toBe('DEL SEGUNDO');
  });

  it('3. el servidor público anterior imprime su aclaración (no en modificación ni en intereses)', () => {
    const fila = () => ({
      'TE DESEMPENASTE COMO SERVIDOR PUBLICO': 'ACL SERVIDOR ANTERIOR',
    });
    const conAcl = (tipo: number) =>
      declaracion(tipo, {}, { fecha_envio_aclaracion: '2024-04-01' });
    const t4 = texto(render('index', conAcl(4), { aclaraciones: fila() }));
    expect(t4).toContain('ACL SERVIDOR ANTERIOR');
    expect(t4).toContain(
      '¿TE DESEMPEÑASTE COMO SERVIDOR PÚBLICO EN EL AÑO INMEDIATO ANTERIOR? Folio: 0000000123 - Aclaración entregada.',
    );
    for (const vista of ['index', 'indexc', 'indexp', 'indexcp'] as const) {
      expect(
        texto(render(vista, conAcl(1), { aclaraciones: fila() })),
      ).toContain('ACL SERVIDOR ANTERIOR');
    }
    expect(
      texto(render('index', conAcl(3), { aclaraciones: fila() })),
    ).not.toContain('ACL SERVIDOR ANTERIOR');
    expect(
      texto(
        render('index', conAcl(5), { aclaraciones: fila(), intereses: true }),
      ),
    ).not.toContain('ACL SERVIDOR ANTERIOR');
  });

  const otroEmpleo = () =>
    modelo(
      'DatoEmpleoDeclarante',
      {
        respuesta_id: 1,
        aclaraciones: 'ACL DEL EMPLEO',
        funcion_principal: 'F',
      },
      {
        experiencia_laboral: modelo(
          'ExperienciaLaboral',
          {
            ente_publico: 'OTRO ENTE X',
            cargo_comision: 'OTRO CARGO',
            fecha_ingreso: '2020-01-01',
          },
          {
            ambito_sectores: cat('PÚBLICO'),
            domicilio: modelo('Domicilio', {
              calle: 'CALLE OTRA',
              num_ext: '77',
            }),
          },
        ),
      },
    );

  it('4. el bloque "otro empleo" se muestra en modificación cuando existe y el empleo muestra su aclaración', () => {
    const t = texto(
      render(
        'index',
        declaracion(3, { datos_empleo_declarante: otroEmpleo() }),
      ),
    );
    expect(t).toContain(
      '¿Cuenta con otro empleo, cargo o comisión en el servicio público distinto al declarado? (SÍ)',
    );
    expect(t).toContain('OTRO ENTE X');
    expect(t).toContain('OTRO CARGO');
    expect(t).toContain('CALLE OTRA');
    expect(t).toContain('ACL DEL EMPLEO');
    // Solo en modificación, como en la vista original.
    expect(
      texto(
        render(
          'index',
          declaracion(4, { datos_empleo_declarante: otroEmpleo() }),
        ),
      ),
    ).not.toContain('OTRO ENTE X');
    expect(texto(render('index', declaracion(3)))).not.toContain(
      '¿Cuenta con otro empleo',
    );
  });

  it('4. el catálogo cuelga la experiencia laboral del empleo por su tipo', () => {
    expect(
      CATALOGO['DatoEmpleoDeclarante'].relaciones['experiencia_laboral'],
    ).toMatchObject({
      destino: 'ExperienciaLaboral',
      tipoValor: 'App\\DatoEmpleoDeclarante',
    });
  });

  it('5. la cadena original en base64 sale cuando la declaración está Enviada', () => {
    expect(texto(render('index', declaracion(1)))).toContain(
      'Cadena Original: fHwgSU5JQ0lBTDoxMjM',
    );
    for (const vista of ['indexc', 'indexp', 'indexcp'] as const) {
      expect(texto(render(vista, declaracion(1)))).toContain(
        'Cadena Original:',
      );
    }
    const pendiente = declaracion(1);
    pendiente.relaciones.set(
      'estatus_declaracion',
      modelo('EstatusDeclaracion', { estatus: 'Terminada' }),
    );
    expect(texto(render('index', pendiente))).not.toContain('Cadena Original:');
  });

  it('6. los datos que salían en blanco ahora salen', () => {
    const rel = (clase: string, nombre: string) =>
      CATALOGO[clase].relaciones[nombre.toLowerCase()];
    expect(rel('DatoCurricular', 'LugarUbicacionInstitucion')).toMatchObject({
      destino: 'LugarUbicacion',
      claveLocal: 'lugar_ubicacion_id',
    });
    expect(rel('DependienteEconomico', 'relacionDeclarante')).toMatchObject({
      destino: 'RelacionTransmisor',
      claveLocal: 'relacion_transmisor_id',
    });
    expect(rel('ExperienciaLaboral', 'regimen_fiscal')).toMatchObject({
      destino: 'regimenFiscal',
      claveLocal: 'regimen_fiscal_id',
    });
    expect(rel('Representacion', 'titular')).toMatchObject({
      destino: 'titularBien',
      claveLocal: 'titular_id',
    });

    const t = texto(
      render(
        'index',
        declaracion(1, {
          datos_curriculares: lista(
            modelo(
              'DatoCurricular',
              { carrera_area: 'X' },
              { LugarUbicacionInstitucion: cat('EXTRANJERO') },
            ),
          ),
          dependienteeconomicos: lista(
            modelo(
              'DependienteEconomico',
              { nombre: 'HIJO', respuesta_id: 1 },
              { relacionDeclarante: cat('HIJO(A)') },
            ),
          ),
          experiencias_laborales: lista(
            modelo(
              'ExperienciaLaboral',
              { ambito_sector_id: 2, nombre_empresa: 'EMPRESA' },
              { regimen_fiscal: cat('PERSONA MORAL') },
            ),
          ),
          representacion: lista(
            modelo(
              'Representacion',
              { monto_mensual: 1 },
              { titular: cat('DECLARANTE REP') },
            ),
          ),
        }),
      ),
    );
    expect(t).toContain('EXTRANJERO');
    expect(t).toContain('HIJO(A)');
    expect(t).toContain('PERSONA MORAL');
    expect(t).toContain('DECLARANTE REP');
  });

  it('6. el país de un fideicomiso en el extranjero sale de su columna pais', () => {
    const t = texto(
      render(
        'index',
        declaracion(1, {
          fideicomisos: lista(
            modelo('Fideicomiso', { lugares_ubicacion_id: 2, pais: 'francia' }),
          ),
        }),
      ),
    );
    expect(t).toContain('FRANCIA');
  });

  const inmuebleConUnidades = (
    terreno: string | null,
    construccion: string | null,
  ) =>
    modelo(
      'BienInmueble',
      {
        tipo_inmueble_id: 1,
        porcentaje_propiedad: 100,
        superficie_terreno: 714,
        superficie_construccion: 420,
      },
      {
        unidadDeMedidaTerreno: terreno
          ? modelo('unidadDeMedida', { clave: terreno })
          : null,
        unidadDeMedidaConstruccion: construccion
          ? modelo('unidadDeMedida', { clave: construccion })
          : null,
      },
    );

  it('7. el porcentaje lleva un solo % y la unidad sale del catálogo (sin KM2 por omisión)', () => {
    const t = (terreno: string | null, construccion: string | null) =>
      texto(
        render(
          'index',
          declaracion(1, {
            bienes_inmuebles: lista(inmuebleConUnidades(terreno, construccion)),
          }),
        ),
      );
    const completo = t('m2', 'km2');
    expect(completo).toContain('100% 714 M2 420 KM2');
    expect(completo).not.toContain('100%%');
    expect(t('ha', 'ha')).toContain('100% 714 HA 420 HA');
    const sin = t(null, null);
    expect(sin).toContain('100% 714 420');
    expect(sin).not.toContain('KM2');
  });

  it('8. dependiente en el extranjero: número exterior bajo "Número exterior" e interior bajo "Número interior / Piso"', () => {
    const html = render(
      'index',
      declaracion(1, {
        dependienteeconomicos: lista(
          modelo(
            'DependienteEconomico',
            { nombre: 'X', respuesta_id: 2, lugar_residencia_id: 2 },
            {
              domicilio: modelo('Domicilio', {
                calle: 'CALLE EXT',
                num_ext: 'EXT-1',
                num_int: 'INT-2',
              }),
            },
          ),
        ),
      }),
    );
    expect(html).toMatch(
      /<td>CALLE EXT<\/td>\s*<td>EXT-1<\/td>\s*<td>INT-2<\/td>/,
    );
  });

  it('9. el texto de la declaración de intereses no repite el párrafo', () => {
    for (const vista of ['index', 'indexc', 'indexp', 'indexcp'] as const) {
      const t = texto(
        render(
          vista,
          declaracion(5, { folioIntereses: modelo('F', { folio: 1 }) }),
          { intereses: true },
        ),
      );
      expect(t).toContain(
        'utilizando el Decl@ra Legis NET, de acuerdo a los artículo 3, fracciones V y VIII; 7 fracciones II y IX; 9 fracción IX; 29, 32, 40, 44, 45 y 46, tercer párrafo',
      );
      expect(t.match(/presentó ante la Contraloría/g)).toHaveLength(1);
    }
  });
});

describe('cadena original (texto y base64 de la misma fuente)', () => {
  const decodificada = (html: string) => {
    const m = /Cadena Original:<\/strong><br>([A-Za-z0-9+/=]+)/.exec(html);
    return m ? Buffer.from(m[1], 'base64').toString('utf8') : null;
  };

  it('el base64 decodifica exactamente la cadena impresa, en las 4 vistas', () => {
    for (const vista of ['index', 'indexc', 'indexp', 'indexcp'] as const) {
      const html = render(
        vista,
        declaracion(
          3,
          { ingresos: ingresos() },
          { fecha_envio_aclaracion: '2024-04-01' },
        ),
      );
      const cadena = decodificada(html);
      expect(cadena).toContain(
        '|| MODIFICACION:123 | FOLIO:0000000123 | RFC:GARS631121 | PRIMER APELLIDO:garcia',
      );
      expect(cadena).toContain('INGRESO ANUAL DECLARANTE: $ 12,345.60');
      expect(cadena).toContain(
        'ACLARACIÓNES: SI || FECHA ENVIO ACLARACIÓN: 2024-04-01',
      );
      expect(cadena?.startsWith('|| ')).toBe(true);
      // Es el mismo texto que se imprime bajo "CADENA ORIGINAL".
      const impreso = textoPlano(html);
      expect(impreso).toContain(`CADENA ORIGINAL ${cadena}`);
    }
  });

  it('la variante de intereses lleva el folio de intereses en el texto y en el base64', () => {
    const html = render(
      'index',
      declaracion(5, {
        folioIntereses: modelo('FoliosIntereses', { folio: 77 }),
      }),
      { intereses: true },
    );
    const cadena = decodificada(html);
    expect(cadena).toContain(
      '|| INTERESES: 77-D.INT. | FOLIO: 0000000077-D.INT. |',
    );
    expect(textoPlano(html)).toContain(`CADENA ORIGINAL ${cadena}`);
  });

  it('el base64 es UTF-8 (acentos y eñes) y no sale si la declaración no está Enviada', () => {
    const html = render('index', declaracion(1));
    expect(decodificada(html)).toContain('DIRECCIÓN: DIRECCION X');
    const pendiente = declaracion(1);
    pendiente.relaciones.set(
      'estatus_declaracion',
      modelo('EstatusDeclaracion', { estatus: 'Terminada' }),
    );
    expect(decodificada(render('index', pendiente))).toBeNull();
    // El texto de la cadena sigue imprimiéndose.
    expect(texto(render('index', pendiente))).toContain('|| INICIAL:123 |');
  });
});
