export class HistoryResolver {
  canResolve(field, context) {
    return context.history && context.history.length > 0;
  }

  resolve(field, context) {
    const { history, currentInput, schema } = context;

    // 🔹 1. PRIORIDAD: input actual (solo ciertos campos)
    if (this.#isUserField(field)) {
      const userValue = this.#extractFromText(field, currentInput);

      if (this.#isValid(field, userValue, schema)) {
        return userValue;
      };
    };

    // 🔹 2. HISTORIAL (reverse)
    for (let i = history.length - 1; i >= 0; i--) {
      const step = history[i];
      const results = step?.observation?.toolResults;

      if (!results) continue;

      let candidate;

      // CASO A: array
      if (Array.isArray(results)) {
        candidate = this.#findInArray(field, results);
      }

      // CASO B: objeto
      else if (typeof results === 'object' && results !== null) {
        candidate = results[field];
      };

      // 🔥 VALIDACIÓN (CLAVE)
      if (this.#isValid(field, candidate, schema)) {
        return candidate;
      };
    };

    return undefined;
  };

  // ------------------------
  // VALIDACIÓN (GENÉRICA)
  // ------------------------
  #isValid(field, value, schema) {
    if (value === undefined || value === null) return false;

    const fieldSchema = schema?.shape?.[field];
    if (!fieldSchema) return false;

    // 🔹 tipo básico
    if (fieldSchema.type === "string") {
      if (typeof value !== "string") return false;
      if (value.trim().length === 0) return false;
    }

    // 🔹 filtro anti-basura (GENÉRICO)
    if (typeof value === "string") {
      const v = value.toLowerCase().trim();

      if (v.length < 3) return false;

      const blacklist = ["el", "la", "los", "las"];
      if (blacklist.includes(v)) return false;

      // ⚠️ evita meter fechas en campos que no son date
      if (field !== "date" && /\d{1,2}\s+de\s+\w+/.test(v)) {
        return false;
      }
    }

    return true;
  }

  // ------------------------
  // INPUT PARSING
  // ------------------------
  #isUserField(field) {
    const userFields = ['passengerName', 'from', 'to', 'location'];
    return userFields.includes(field);
  };

  #extractFromText(field, text) {
    if (!text || typeof text !== 'string') return null;

    const patterns = {
      passengerName: /(?:pasajero|nombre)\s+([\w\s]+)/i,
      from: /desde\s+([a-záéíóúñ]+)/i,
      to: /(?:hacia)\s+([a-záéíóúñ]+)/i
    };

    const match = text.match(patterns[field]);

    if (!match) return null;

    const value = match[1].trim();

    if (this.#isGarbage(value)) return null;

    return value;
  };

  #isGarbage(value) {
    const blacklist = ["el", "la", "los", "las", "abril", "mañana", "hoy"];

    return (
      value.length < 3 ||
      blacklist.includes(value.toLowerCase())
    );
  };

  // ------------------------
  // HISTORY SEARCH
  // ------------------------
  #findInArray(field, array) {
    for (const item of array) {
      if (item && typeof item === 'object' && item[field]) {
        return item[field];
      }
    }
    return null;
  };
};
