export class InputResolver {

  canResolve(field, context) {
    return !!context.currentInput;
  };

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

  extractByHint(text, hint) {
    if (!hint) return null;

    // ejemplo genérico: "from madrid"
    const regex = new RegExp(`${hint}\\s+([a-záéíóúñ]+)`);
    const match = text.match(regex);

    return match ? this.capitalize(match[1]) : null;
  };

  capitalize(word) {
    if (!word) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  };
};
