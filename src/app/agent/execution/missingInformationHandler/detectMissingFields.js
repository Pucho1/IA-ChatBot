/**
 * Comprueba si una herramienta dispone de todos los argumentos definidos por
 * su schema antes de permitir la ejecucion.
 *
 * La comprobacion se basa en las claves de `schema.shape`. Un campo se marca
 * como faltante unicamente cuando su valor es `undefined` o una cadena vacia.
 */
export class MissingInfoGuard {


  
  /**
   * Detecta los argumentos que no tienen valor util para la herramienta.
   *
   * Los valores `null`, `0` y `false` se consideran presentes porque este
   * guard no interpreta el tipo ni las reglas de validacion del schema.
   *
   * @param {object} params Parametros de la comprobacion.
   * @param {object} params.args Argumentos normalizados de la herramienta.
   * @param {object} params.schema Schema con una propiedad `shape` enumerable.
   * @returns {{blocked: boolean, missingFields?: string[]}} Resultado de la
   *   comprobacion y, si aplica, nombres de los campos faltantes.
   */
  check({ args, schema }) {
    const shape = schema.shape;
    const missing = [];

    for (const key in shape) {
      if (args[key] === undefined || args[key] === "") {
        missing.push(key);
      }
    }

    if (missing.length > 0) {
      return {
        blocked: true,
        missingFields: missing,
      };
    }

    return { blocked: false };
  }
}
