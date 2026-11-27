import { Modelo, propiedad } from './blade/valores';
import type { Arbol } from './eloquent/tipos';

/**
 * Secciones de aclaraciones que arma ReporteDeclaracionController (openPDF y
 * openPDFPrivada son idénticos en esto). El orden y los textos de las claves son
 * los del sistema anterior; las plantillas preguntan por ellas con `$key == "..."`.
 */
export interface SeccionAclaracion {
  clave: string;
  /**
   * Relación de la declaración (en minúsculas) cuyos registros traen la aclaración
   * (`aclaracionesDecl`); se toma la del primer registro que la tenga.
   * Null: la aclaración cuelga directo de `directa`.
   */
  relacion: string | null;
  /** Ruta de relaciones (en minúsculas) hasta la aclaración misma. */
  directa?: string[];
  /**
   * Tipo (`App\X`) de las aclaraciones que los datos viejos guardaron con el id de la
   * declaración en lugar del id del registro: se usan si no hay otra y ese id no es
   * de ningún registro de la tabla del tipo.
   */
  respaldo?: string;
  /** Solo cuando la situación personal es 2, 5 o 6 (con pareja). */
  soloConPareja?: boolean;
  /** Solo cuando el tipo de movimiento no es 3 (modificación). */
  noModificacion?: boolean;
  /** La declaración fiscal tiene un texto fijo cuando la observación viene vacía. */
  declaracionFiscal?: boolean;
}

export const SECCIONES_ACLARACION: SeccionAclaracion[] = [
  { clave: 'DATOS GENERALES', relacion: null, directa: ['aclaraciones'] },
  {
    clave: 'DOMICILIO DECLARANTE',
    relacion: null,
    directa: ['domicilio', 'aclaraciones'],
  },
  {
    clave: 'DATOS CURRICULARES',
    relacion: 'datos_curriculares',
    respaldo: 'App\\DatoCurricular',
  },
  { clave: 'DATOS EMPLEO', relacion: 'datos_empleo_declarante' },
  {
    clave: 'EXPERIENCIA LABORAL',
    relacion: 'experiencias_laborales',
    respaldo: 'App\\ExperienciaLaboral',
  },
  { clave: 'DATOS DE LA PAREJA', relacion: 'pareja', soloConPareja: true },
  {
    clave: 'DATOS DE LOS DEPENDIENTES',
    relacion: 'dependienteeconomicos',
    respaldo: 'App\\DependienteEconomico',
  },
  { clave: 'INGRESOS NETOS', relacion: 'ingresos' },
  {
    clave: 'TE DESEMPENASTE COMO SERVIDOR PUBLICO',
    relacion: 'fueservidorpublico',
    noModificacion: true,
  },
  {
    clave: 'DECLARACION FISCAL',
    relacion: 'documentosat',
    respaldo: 'App\\DocumentoSat',
    declaracionFiscal: true,
  },
  {
    clave: 'BIENES INMUEBLES',
    relacion: 'bienes_inmuebles',
    respaldo: 'App\\BienInmueble',
  },
  { clave: 'VEHICULOS', relacion: 'vehiculos', respaldo: 'App\\Vehiculo' },
  {
    clave: 'BIENES MUEBLES',
    relacion: 'bienesmuebles',
    respaldo: 'App\\BienesMuebles',
  },
  {
    clave: 'INVERSIONES, CUENTAS BANCARIAS',
    relacion: 'inversiones_cuentas',
    respaldo: 'App\\InversionesDeclarante',
  },
  {
    clave: 'ADEDUOS / PASIVOS',
    relacion: 'adeudos_pasivos',
    respaldo: 'App\\AdeudosPasivos',
  },
  {
    clave: 'PRESTAMO O COMODATOS A TERCEROS',
    relacion: 'prestamoscomodato',
    respaldo: 'App\\PrestamoComodato',
  },
  {
    clave: 'PARTICIPACION ECONOMICA O FINANCIERA EN EMPRESAS',
    relacion: 'participacion_empresas',
    respaldo: 'App\\ParticipacionEmpresa',
  },
  {
    clave:
      'PARTICIPA EN LA TOMA DE DECISIONES DE ALGUNAS DE ESTAS INSTITUCIONES',
    relacion: 'participacion',
    respaldo: 'App\\Participacion',
  },
  {
    clave: 'APOYO O BENEFICIOS PUBLICOS',
    relacion: 'apoyo_beneficio',
    respaldo: 'App\\ApoyoBeneficio',
  },
  {
    clave: 'REPRESENTACION',
    relacion: 'representacion',
    respaldo: 'App\\Representacion',
  },
  {
    clave: 'CLIENTES PRINCIPALES',
    relacion: 'clientes',
    respaldo: 'App\\Clientes',
  },
  {
    clave: 'BENEFICIOS PRIVADOS',
    relacion: 'beneficios_privados',
    respaldo: 'App\\BeneficioPrivado',
  },
  {
    clave: 'FIDEICOMISOS',
    relacion: 'fideicomisos',
    respaldo: 'App\\Fideicomiso',
  },
  { clave: 'DONATIVOS', relacion: 'donativos', respaldo: 'App\\Donativo' },
  {
    clave: 'INTERESES PERSONALES',
    relacion: 'intereses',
    respaldo: 'App\\InteresesPersonal',
  },
  {
    clave: 'PARTICIPACIONES',
    relacion: 'participaciones',
    respaldo: 'App\\ParticipacionDeclaracion',
  },
  { clave: 'VIAJES', relacion: 'viajes', respaldo: 'App\\Viajes' },
];

/** Secciones que la versión reducida (nivel bajo) no imprime ni aclara. */
export const CLAVES_SOLO_COMPLETA = [
  'BIENES INMUEBLES',
  'VEHICULOS',
  'BIENES MUEBLES',
  'INVERSIONES, CUENTAS BANCARIAS',
  'ADEDUOS / PASIVOS',
  'PRESTAMO O COMODATOS A TERCEROS',
];

const SITUACIONES_CON_PAREJA = [2, 5, 6];

/** Relaciones que hay que precargar para armar las aclaraciones. */
export function arbolAclaraciones(): Arbol {
  const arbol: Arbol = {};
  for (const s of SECCIONES_ACLARACION) {
    if (s.relacion) arbol[s.relacion] = { aclaracionesdecl: {} };
    if (s.directa) {
      let nodo = arbol;
      for (const paso of s.directa) nodo = nodo[paso] ??= {};
    }
  }
  return arbol;
}

/** Aclaración del primer registro de la relación que tenga una (`aclaracionesDecl`). */
function deRelacion(declaracion: Modelo, relacion: string): Modelo | null {
  const valor = declaracion.relaciones.get(relacion);
  const registros = Array.isArray(valor) ? (valor as unknown[]) : [valor];
  for (const registro of registros) {
    const aclaracion = propiedad(registro, 'aclaracionesDecl');
    if (aclaracion instanceof Modelo) return aclaracion;
  }
  return null;
}

/** Aclaración que cuelga directo siguiendo una ruta de relaciones desde la declaración. */
function deRuta(declaracion: Modelo, ruta: string[]): Modelo | null {
  let actual: unknown = declaracion;
  for (const paso of ruta) actual = propiedad(actual, paso);
  return actual instanceof Modelo ? actual : null;
}

/**
 * Arma el arreglo $aclaraciones del controlador. `respaldo` trae, por tipo, la
 * observación de las aclaraciones que los datos viejos guardaron con el id de la
 * declaración (solo si ese id no es de un registro de la tabla del tipo).
 */
export function armarAclaraciones(
  declaracion: Modelo,
  respaldo: Map<string, string | null>,
): Record<string, string | null> {
  const aclaraciones: Record<string, string | null> = {};
  for (const s of SECCIONES_ACLARACION) aclaraciones[s.clave] = null;

  const tipoMovimiento = Number(declaracion.atributos['tipo_movimiento_id']);
  const situacion = Number(declaracion.atributos['situacion_personal_id']);

  for (const s of SECCIONES_ACLARACION) {
    if (!s.relacion && !s.directa) continue;
    if (s.soloConPareja && !SITUACIONES_CON_PAREJA.includes(situacion))
      continue;
    if (s.noModificacion && tipoMovimiento === 3) continue;

    const aclaracion = s.relacion
      ? deRelacion(declaracion, s.relacion)
      : deRuta(declaracion, s.directa ?? []);
    if (aclaracion) {
      const observaciones = aclaracion.atributos['observaciones'] as
        string | null;
      aclaraciones[s.clave] =
        s.declaracionFiscal && (observaciones ?? '') === ''
          ? 'NO REALIZO MANIFESTACION ALGUNA, NO OBSTANTE SUBIO UN ARCHIVO EN PDF.'
          : observaciones;
    } else if (s.respaldo && respaldo.has(s.respaldo)) {
      aclaraciones[s.clave] = respaldo.get(s.respaldo) ?? null;
    }
  }
  return aclaraciones;
}
