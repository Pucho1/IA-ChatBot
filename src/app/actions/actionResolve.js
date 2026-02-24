/**
 * Traduce la salida del LLM a algo ejecutable.
 * @param {*} response {
    *   type: "final" | "tool",
    *  content?: string, // para type final
    *  tool?: string, // para type tool
    *  args?: any // para type tool
 * }
 * @returns Salida del LLM normalizada.
 */
export function resolveAction(response) {

    if(response.type === 'final') {
        return {type: "message", content: response.content}
    };

    if (response.type === "tool") {
        return {
            type: "tool",
            tool: response.tool,
            args: response.args
        };
    };

    return {
        type: "final",
        content: "Respuesta no válida."
    };
};
