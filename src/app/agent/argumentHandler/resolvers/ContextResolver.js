export class ContextResolver {
  
    canResolve(field, context) {
        return !!context?.state?.context?.selected;
    };

    async resolve(field, context) {
        const selected = context.state.context.selected;
        const selectedData = selected?.data || selected;

        if (!selectedData) return null;

        // 🔥 clave: resolución genérica por nombre de campo
        if (selectedData[field] !== undefined) {
        return selectedData[field];
        }

        return null;
    };

};
