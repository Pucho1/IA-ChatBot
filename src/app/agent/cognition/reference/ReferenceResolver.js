/**
 * Resuelve referencias del usuario hacia opciones obtenidas previamente.
 *
 * Permite interpretar expresiones ordinales como "el primero", "el segundo"
 * o "el tercero", además de referencias al ultimo elemento de una lista.
 * Las opciones se leen desde `state.context.options`.
 */
export class ReferenceResolver {

    /**
     * Busca una referencia en la entrada del usuario y la vincula con una
     * opcion almacenada en el contexto de la sesion.
     *
     * Si no existe historial, no se reconoce un ordinal o no hay opciones
     * disponibles, devuelve `null`. Cuando encuentra una opcion, conserva los
     * datos del resultado y establece `entity` en `"unknown"`.
     *
     * @param {object} params Parametros de resolucion.
     * @param {string} params.input Texto recibido del usuario.
     * @param {object} params.state Estado actual del agente.
     * @param {Array} [params.state.history] Historial de interacciones.
     * @param {object} [params.state.context] Contexto de la sesion.
     * @returns {object|null} Referencia resuelta o `null` si no se pudo resolver.
     */
    resolve({ input, state }){

        if (state?.history?.length === 0) { // No hay historia, no se puede resolver referencia
            return null; 
        };

        const lower = input.toLowerCase();
        let index = null;

        if (lower.includes("primero") || lower.includes("primera") || lower.includes("1")) index = 0;
        if (lower.includes("segundo") || lower.includes("segunda") || lower.includes("2")) index = 1;
        if (lower.includes("tercero") || lower.includes("tercera") || lower.includes("3")) index = 2;
        if (lower.includes("último") || lower.includes("última"))  index = -1;

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
     * Obtiene una opcion de la lista almacenada en el contexto.
     *
     * El índice `0`, `1` y `2` representa respectivamente la primera,
     * segunda y tercera opcion. El índice `-1` representa la ultima opcion.
     * Si no existen opciones, no devuelve ningun resultado.
     *
     * @param {object} state Estado actual del agente.
     * @param {number} index Índice de la opcion solicitada.
     * @returns {{type: "selection", value: *}|undefined} Resultado de seleccion
     *   o `undefined` cuando el contexto no contiene opciones.
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
