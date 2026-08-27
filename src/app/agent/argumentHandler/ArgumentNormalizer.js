/** Normaliza y valida los argumentos generados para una herramienta. */
export class ArgumentNormalizer {

  
  /**
   * Limpia, adapta al schema y valida los argumentos recibidos.
   * @param {{args: object|string, schema: object}} params Argumentos y schema Zod.
   * @returns {object} Argumentos validados y coercionados.
   * @throws {Error} Si los argumentos no cumplen el schema.
   */
  normalize({ args, schema }) {
    // 1. Limpieza inicial (por si el LLM envió basura alrededor del JSON)
    const rawArgs = typeof args === 'string' ? this.#tryParse(args) : (args || {});
    
    // 2. Adaptación heurística mejorada
    const adapted = this.#adaptToSchema(rawArgs, schema);

    // 3. Validación y Coerción (Zod hace el trabajo pesado aquí)
    const result = schema.safeParse(adapted);


    if (!result.success) {
      // Aquí podrías formatear el error para enviárselo de vuelta al LLM
      const errorDetails = result.error.issues.map(i => `${i.path}: ${i.message}`).join(", ");
      throw new Error(`Normalization Failed: ${errorDetails} ----- adapted was: ${JSON.stringify(adapted)}  ---- result was: ${JSON.stringify(result)}`);
    }
    return result.data;
  };

  /** Ajusta nombres exactos o equivalentes ignorando guiones bajos. */
  #adaptToSchema(args, schema) {
    const shape = schema.shape;
    const adapted = {};

    for (const key in shape) {
      // Prioridad 1: Match Exacto
      if (args[key] !== undefined) {
        adapted[key] = args[key];
        continue;
      };

      // Prioridad 2: Heurística (Fuzzy Match)
      const potentialMatch = Object.keys(args).find(rawKey => 
        rawKey.toLowerCase().replaceAll('_', '') === key.toLowerCase().replaceAll('_', '')
      );

      if (potentialMatch) {
        adapted[key] = args[potentialMatch];
      };
    };
    return adapted;
  };

  /** Intenta convertir una cadena JSON en un objeto. */
  #tryParse(str) {
    try { 
      return JSON.parse(str.replaceAll(/```json|```/g, "")); 
    } catch { 
        return {};
      }
  };
};
