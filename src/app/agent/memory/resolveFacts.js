
/** Decide como combinar un hecho nuevo con uno ya existente. */
export function resolveFact(existing, candidate) {

  // Caso A — No existe
  if (!existing) {
    return { type: "CREATE" };
  }

  // Caso B — Existe y es igual
  if (existing.value === candidate.value) {
    return { type: "IGNORE" };
  }

  // Caso C — El usuario manda
  if (candidate.source === "user") {
    return { type: "REPLACE" };
  }

  // Inferido nunca pisa user
  if (
    candidate.source === "inferred" &&
    existing.source === "user"
  ) {
    return { type: "IGNORE" };
  }

  // Hard facts no se pisan por inferencias
  if (
    existing.type === "hard" &&
    candidate.source === "inferred"
  ) {
    return {
      type: "MARK_CONFLICT",
      reason: "hard_fact_conflict",
    };
  }

  // Soft facts → usar confianza
  if (existing.type === "soft") {
    const values = Array.isArray(existing.value)
        ? existing.value
        : [existing.value];

    if (values.includes(candidate.value)) {
        return { type: "IGNORE" };
    }

    return { type: "APPEND" };
  }

  // Fallback defensivo
  return { type: "IGNORE" };
};
