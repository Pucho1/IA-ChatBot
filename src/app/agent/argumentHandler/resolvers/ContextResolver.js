export class ContextResolver {
  
    canResolve(field, context) {
        return !!context?.state?.context?.selected?.data;
    };

    async resolve(field, context) {
        const selectedData = context.state.context.selected?.data;

        if (!selectedData) return null;

        // 🔥 clave: resolución genérica por nombre de campo
        if (selectedData[field] !== undefined) {
        return selectedData[field];
        }

        return null;
    };

};