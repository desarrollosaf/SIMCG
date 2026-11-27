import { CATALOGO as GENERADO } from './catalogo.generado';
import type { ModeloMeta, RelacionMeta } from './tipos';

/**
 * Relaciones que las vistas del sistema anterior usaban pero que sus modelos no
 * definían (o definían con otra llave), por lo que salían siempre en blanco. Aquí
 * apuntan a la tabla y columna reales. El resto del catálogo es el generado de los
 * modelos Eloquent.
 */
const CORRECCIONES: Record<string, RelacionMeta[]> = {
  // Aclaraciones de "Datos generales" y "Domicilio": se guardan con su propio tipo.
  Declaracion: [
    {
      nombre: 'aclaraciones',
      tipo: 'morphOne',
      destino: 'Aclaraciones',
      claveLocal: 'id',
      claveDestino: 'aclaracionable_id',
      tipoColumna: 'aclaracionable_type',
      tipoValor: 'App\\Declaracion',
    },
  ],
  Domicilio: [
    {
      nombre: 'aclaraciones',
      tipo: 'morphOne',
      destino: 'Aclaraciones',
      claveLocal: 'id',
      claveDestino: 'aclaracionable_id',
      tipoColumna: 'aclaracionable_type',
      tipoValor: 'App\\Domicilio',
    },
  ],
  // "¿Cuenta con otro empleo, cargo o comisión?": su experiencia laboral cuelga del empleo.
  DatoEmpleoDeclarante: [
    {
      nombre: 'experiencia_laboral',
      tipo: 'morphOne',
      destino: 'ExperienciaLaboral',
      claveLocal: 'id',
      claveDestino: 'experienciable_id',
      tipoColumna: 'experienciable_type',
      tipoValor: 'App\\DatoEmpleoDeclarante',
    },
  ],
  DatoCurricular: [
    {
      nombre: 'LugarUbicacionInstitucion',
      tipo: 'belongsTo',
      destino: 'LugarUbicacion',
      claveLocal: 'lugar_ubicacion_id',
      claveDestino: 'id',
    },
  ],
  DependienteEconomico: [
    {
      nombre: 'relacionDeclarante',
      tipo: 'belongsTo',
      destino: 'RelacionTransmisor',
      claveLocal: 'relacion_transmisor_id',
      claveDestino: 'id',
    },
  ],
  ExperienciaLaboral: [
    {
      nombre: 'regimen_fiscal',
      tipo: 'belongsTo',
      destino: 'regimenFiscal',
      claveLocal: 'regimen_fiscal_id',
      claveDestino: 'id',
    },
  ],
  Representacion: [
    {
      nombre: 'titular',
      tipo: 'belongsTo',
      destino: 'titularBien',
      claveLocal: 'titular_id',
      claveDestino: 'id',
    },
  ],
};

function aplicar(): Record<string, ModeloMeta> {
  const catalogo = structuredClone(GENERADO);
  for (const [clase, relaciones] of Object.entries(CORRECCIONES)) {
    for (const rel of relaciones) {
      catalogo[clase].relaciones[rel.nombre.toLowerCase()] = rel;
    }
  }
  return catalogo;
}

export const CATALOGO: Record<string, ModeloMeta> = aplicar();
