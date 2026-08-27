
/** Selecciona la ruta conversacional o de ejecucion del agente. */
export class AgentRouter {

    /** Envia intenciones sociales a conversacion y las demas a ejecucion. */
    async route(interpretation) {
        if (interpretation.intent === "social" || interpretation.intent === "meta_instruction") return "conversation";
        return "execution";
    };
};
