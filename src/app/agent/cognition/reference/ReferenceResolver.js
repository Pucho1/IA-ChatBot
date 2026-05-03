export class ReferenceResolver {

    resolve({ input, state }){

        if (state?.history?.length === 0) { // No hay historia, no se puede resolver referencia
            return null; 
        };

        const lower = input.toLowerCase();
        let index = null;

        if (lower.includes("primero")) index = 0;
        if (lower.includes("segundo")) index = 1;
        if (lower.includes("tercero")) index = 2;
        if (lower.includes("último"))  index = -1;

        if (index === null) return null;

        // Obtengo el último resultado útil de herramienta del estado para resolver la referencia.
       const lastListResult = this.#lastToolResult(state, index); /////////-----

        if (!lastListResult) return null;
        return {
            ...lastListResult,
            entity: "unknown",
        };
    };


    /**
     *  Busca en el estado el último resultado de herramienta que contenga una lista de opciones,
     *  que es lo que necesito para resolver referencias como "el primero", "el segundo", etc.
     * @param {*} state 
     * @returns 
     */
    #lastToolResult(state, index) {

        if (state.context?.options) {
            const items = state.context.options;

            const selected =
                index === -1
                    ? items[items.length - 1]
                    : items[index];

            return {
                type: "selection",
                value: selected,
            };
        };
    };

};
