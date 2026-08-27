/** Resuelve argumentos desde la opcion seleccionada en el contexto. */
export class ContextResolver {
  
    /** Indica si existe una seleccion disponible para consultar. */
    canResolve(field, context) {
        return !!context?.state?.context?.selected;
    };

    /** Devuelve el valor del campo seleccionado, si existe. */
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
