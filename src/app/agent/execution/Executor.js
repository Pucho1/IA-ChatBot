
/** Ejecuta herramientas MCP y unifica sus resultados para el runtime. */
export class Executor {
    /** Guarda el administrador de clientes MCP usado para invocar herramientas. */
    constructor(mcpClientManager) {
        this.mcpClientManager = mcpClientManager;
    }

    /** Ejecuta la herramienta indicada por un paso y captura sus errores. */
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
