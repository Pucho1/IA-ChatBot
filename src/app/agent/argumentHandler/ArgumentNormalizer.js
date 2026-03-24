export class ArgumentNormalizer {
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
      throw new Error(`Normalization Failed: ${errorDetails}`);
    }

    return result.data;
  };

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
        rawKey.toLowerCase().replace(/_/g, '') === key.toLowerCase().replace(/_/g, '')
      );

      if (potentialMatch) {
        adapted[key] = args[potentialMatch];
      };
    };
    return adapted;
  };

  #tryParse(str) {
    try { return JSON.parse(str.replace(/```json|```/g, "")); }
    catch (e) { return {}; }
  };
};
