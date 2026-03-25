export class FactsResolver {
  canResolve(field, context) {
    return context.facts && context.facts.length > 0;
  };

  resolve(field, context) {
    const { facts } = context;

    // buscar fact que coincida con el campo
    const match = facts.find(f => f.key === field);

    return match ? match.value : undefined;
  };
};
