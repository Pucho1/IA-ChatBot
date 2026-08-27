/** Resuelve argumentos usando hechos persistidos en la memoria. */
export class FactsResolver {
  /** Indica si hay hechos disponibles para buscar. */
  canResolve(field, context) {
    return context.facts && context.facts.length > 0;
  };

  /** Devuelve el valor del hecho cuya clave coincide con el campo. */
  resolve(field, context) {
    const { facts } = context;

    // buscar fact que coincida con el campo
    const match = facts.find(f => f.key === field);

    return match ? match.value : undefined;
  };
};
