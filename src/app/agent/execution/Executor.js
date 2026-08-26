
export class Executor {
    constructor(mcpClientManager) {
        this.mcpClientManager = mcpClientManager;
    }

    /**
     *  Ejecuta una herramienta específica con los argumentos proporcionados.
     * @param {*} step
     * @param {*} syntheticId
     * @returns
     */
    async executeTool(step, syntheticId) {

        try {
            const result = await this.mcpClientManager.callTool(
                step.tool,
                step.args
            );

            return {
                id: syntheticId,
                success: true,
                result,
                done: false, // ??
                error: null,
            };

        } catch (error) {
            return {
                id: syntheticId,
                success: false,
                error: error.message || "Unknown error",
                done: false,
                result: null,
            };
        };
    };
};
