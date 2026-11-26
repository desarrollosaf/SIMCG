// Comparación de los datos editables de un servidor: lista de cambios (antes → después)
// que se muestra al confirmar y se guarda en la bitácora.

export interface Cambio {
  campo: string;
  etiqueta: string;
  antes: string | null;
  despues: string | null;
}

// Mismo orden y etiquetas que el formulario de edición.
export const CAMPOS_EDITABLES: readonly (readonly [string, string])[] = [
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

export type Valores = Record<string, string | number | null | undefined>;

/** Texto recortado; vacío o ausente => null (así '' y null no cuentan como cambio). */
export function normalizar(valor: string | number | null | undefined) {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  return texto === '' ? null : texto;
}

/** Campos cuyo valor cambió. Solo compara los campos presentes en `despues`. */
export function calcularCambios(antes: Valores, despues: Valores): Cambio[] {
  const cambios: Cambio[] = [];
  for (const [campo, etiqueta] of CAMPOS_EDITABLES) {
    if (!(campo in despues) || despues[campo] === undefined) continue;
    const valorAntes = normalizar(antes[campo]);
    const valorDespues = normalizar(despues[campo]);
    if (valorAntes !== valorDespues) {
      cambios.push({
        campo,
        etiqueta,
        antes: valorAntes,
        despues: valorDespues,
      });
    }
  }
  return cambios;
}
