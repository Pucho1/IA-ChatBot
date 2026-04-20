export class GoalVerifier {
    constructor({ engine }) {
        this.engine = engine;
    };
    /**
     * Verifica si el goal se ha cumplido basado en el estado actual del agente, esto es solo un ejemplo y deberías adaptarlo a tus necesidades reales.
     * @param {*} state 
     * @returns 
     */
    async verify({ state }) {

        const goalType = this.#detectGoalType(state.goal);
        const capabilities = this.#getRequiredCapabilities(goalType);
        return this.#checkCapabilities(capabilities, state);

        // const prompt = [
        //     {
        //         role: "system",
        //         content: `
        //             You are evaluating whether an AI agent has successfully completed a goal.

        //             You must be STRICT.

        //             Rules:
        //             - Only say success = true if the goal is fully achieved
        //             - If something is missing → false
        //             - Do NOT assume
        //             - Do NOT hallucinate
        //             - Base your answer ONLY on execution evidence
        //         `
        //     },
        //     {
        //         role: "user",
        //         content: `
        //             GOAL:
        //             ${goal}

        //             EXECUTION HISTORY:
        //             ${JSON.stringify(history, null, 2)}

        //             CONTEXT:
        //             ${JSON.stringify(context, null, 2)}

        //             Did the agent successfully complete the goal?

        //             Return JSON:
        //             {
        //             "success": true/false,
        //             "confidence": 0.0-1.0,
        //             "reason": "short explanation"
        //             }
        //         `
        //     }
        // ];

        // const result = await this.engine.executeVerificationGoal(prompt);

        // return result;
    };


    /**
     * Detecta el tipo de objetivo basado en su contenido, esto es solo un ejemplo y deberías adaptarlo a tus necesidades reales.
     * @param {*} goal 
     * @returns 
     */
    #detectGoalType(goal) {
        // Aquí podrías implementar lógica para detectar el tipo de objetivo basado en su contenido
        // Por ejemplo, podrías buscar palabras clave o patrones específicos
       const g = goal.toLowerCase();

        if (g.includes("reserva")) return "booking";
        if (g.includes("vuelo")) return "search";
        if (g.includes("día") || g.includes("fecha")) return "date";

        return "unknown";
    };

    /**
     * Mapea cada tipo de objetivo a las capacidades requeridas para considerarlo cumplido, esto es solo un ejemplo y deberías adaptarlo a tus necesidades reales.
     * @param {*} goalType 
     * @returns 
     */
    #getRequiredCapabilities(goalType) {
        const map = {
            booking: ["selection_done", "booking_done"],
            search: ["options_presented"],
            date: ["information_delivered"],
        };

        return map[goalType] || [];
    };

    /**
     *  chequea si se cumplen las capacidades requeridas para el tipo de objetivo, basado en el estado actual del agente (historial, contexto, etc)
     * @param {*} capabilities 
     * @param {*} state 
     * @returns 
     */
    #checkCapabilities(capabilities, state) {
        const results = capabilities.map(cap => {
            return this.#checkSingle(cap, state);  // chequeo cada capacidad individualmente y guardo el resultado (true/false) en un array, 
            // luego verifico que todas sean true para considerar el goal como cumplido.
        });

        console.log("----Capability check results -----", {capabilities, results});

        const success = results.every(r => r === true);

        return {
            success,
            missing: capabilities.filter((_, index) => !results[index]) // Devuelvo también qué capacidades faltan para cumplir el objetivo, si alguna false al ponerla true sale devulta.
            // esto puede ser útil para debugging o para que el agente se replantee su estrategia.
        };
    };

    /**
     * chequea individualmente cada capacidad requerida para el goal, basado en el estado actual del agente (historial, contexto, etc)
     * @param {*} cap 
     * @param {*} state 
     * @returns 
     */
    #checkSingle(cap, state) {
        switch (cap) {

            case "selection_done":
                return !!state.context.selected;

            case "options_presented":
                return Array.isArray(state.context.options) && state.context.options.length > 0;

            case "booking_done":
                return state.history.some(h =>
                    h.decision.tool === "bookFlight" &&
                    h.observation.success
                );

            case "information_delivered":
                const hasTool = state.history.some(h =>
                    h.decision.tool === "getCurrentDate" &&
                    h.observation.success
                );

                const hasOutput = state.history.length > 0;

                return hasTool && hasOutput;

                default:
                return false;
        }
    };
};
