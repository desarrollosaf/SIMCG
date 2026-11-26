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
