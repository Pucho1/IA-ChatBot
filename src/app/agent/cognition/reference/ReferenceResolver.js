export class ReferenceResolver {
    constructor() {};

    resolve({ input, state }){

        console.log("Resolviendo referencia para input:", {input}, "con estado:", {state});

        if (state?.history?.length === 0) {
            return null; // No hay historia, no se puede resolver referencia
        };

        const lower = input.toLowerCase();
        let index = null;

        if (lower.includes("primero")) index = 0;
        if (lower.includes("segundo")) index = 1;
        if (lower.includes("tercero")) index = 2;
        if (lower.includes("último"))  index = -1;

        if (index === null) return null;

        console.log("Índice detectado en la referencia ------->:", {index});


        // Obtengo el último resultado útil de herramienta del estado para resolver la referencia.
       const lastListResult = this.#lastListResult(state, index); /////////-----


        console.log("Último resultado de herramienta encontrado para resolver referencia:", {lastListResult});

        if (!lastListResult) return null; // No se encontró un resultado de herramienta para resolver la referencia


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
    #lastListResult(state, index) {

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
