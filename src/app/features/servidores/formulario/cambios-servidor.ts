// Lista de cambios (antes → después) que se muestra al confirmar la edición.
// Mismos campos, etiquetas y orden que valida y registra el backend.

export interface CambioCampo {
  campo: string;
  etiqueta: string;
  antes: string;
  despues: string;
}

export type ValorCampo = string | number | null | undefined;

export const CAMPOS_COMPARABLES: readonly (readonly [string, string])[] = [
  ['rfc', 'RFC'],
  ['homoclave', 'Homoclave'],
  ['curp', 'CURP'],
  ['nombre', 'Nombre(s)'],
  ['primerApellido', 'Primer apellido'],
  ['segundoApellido', 'Segundo apellido'],
  ['cargo', 'Nombre del empleo, cargo o comisión'],
  ['nivelCargo', 'Nivel del empleo, cargo o comisión'],
  ['cveIssemym', 'Clave ISSEMYM'],
  ['tipoDependenciaId', 'Adscripción'],
  ['tipoDireccionId', 'Dirección'],
  ['tipoDepartamentoId', 'Departamento'],
  ['honorarios', '¿Está contratado por honorarios?'],
  ['email', 'Correo'],
];

export const SIN_VALOR = '(vacío)';

/** Texto recortado; vacío o ausente => ''. */
export function normalizarValor(valor: ValorCampo): string {
  return valor === null || valor === undefined ? '' : String(valor).trim();
}

/**
 * Campos que cambiaron entre `antes` y `despues`. `nombrar` convierte ids de
 * catálogo (adscripción, honorarios) en su texto para mostrarlos.
 */
export function calcularCambios(
  antes: Record<string, ValorCampo>,
  despues: Record<string, ValorCampo>,
  nombrar: (campo: string, valor: string) => string = (_, valor) => valor,
): CambioCampo[] {
  const cambios: CambioCampo[] = [];
  for (const [campo, etiqueta] of CAMPOS_COMPARABLES) {
    if (!(campo in despues)) continue;
    const a = normalizarValor(antes[campo]);
    const d = normalizarValor(despues[campo]);
    if (a === d) continue;
    cambios.push({
      campo,
      etiqueta,
      antes: a ? nombrar(campo, a) : SIN_VALOR,
      despues: d ? nombrar(campo, d) : SIN_VALOR,
    });
  }
  return cambios;
}
