/** Extrae argumentos directamente de la entrada actual del usuario. */
export class InputResolver {

  /** Indica si existe una entrada actual que analizar. */
  canResolve(field, context) {
    return !!context.currentInput;
  };

  /** Busca el valor usando el nombre y la descripcion del campo. */
  resolve(field, context) {
    const { currentInput, schema } = context;
    const fieldSchema = schema.shape[field];

    if (!fieldSchema) return null;

    const text = currentInput.toLowerCase();

    // 🔥 usamos metadata del schema
    const hints = this.getFieldHints(field, fieldSchema);

    // 🔥 intentamos patrones basados en hints
    for (const hint of hints) {
      const value = this.extractByHint(text, hint);
      if (value) return value;
    }

    return null;
  };

  // -------------------------
  // 🔹 HINTS GENERATION
  // -------------------------

  /** Genera pistas a partir del campo y su descripcion. */
  getFieldHints(field, fieldSchema) {
    const description = fieldSchema.description?.toLowerCase() || "";

    return [
      field.toLowerCase(),        // "from", "date"
      description,                // "fecha del viaje"
    ];
  };

  // -------------------------
  // 🔹 GENERIC EXTRACTION
  // -------------------------

  /** Extrae la palabra que aparece despues de una pista. */
  extractByHint(text, hint) {
    if (!hint) return null;

    // ejemplo genérico: "from madrid"
    const regex = new RegExp(`${hint}\\s+([a-záéíóúñ]+)`);
    const match = text.match(regex);

    return match ? this.capitalize(match[1]) : null;
  };

  /** Capitaliza la primera letra de un valor extraido. */
  capitalize(word) {
    if (!word) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  };
};
