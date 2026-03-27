import routes from "./routesTypes"

export class AgentRouter {

    route(currentInput, state) {

        const normalizedCurrentInput = currentInput.toLowerCase().trim();
        const statusBlocked  = "waiting_for_input";

        // Si estamos esperando un dato, da igual si parece saludo, es EXECUTION
        if (state.status === statusBlocked) return "execution";

        // 🔹 1. conversación básica
        if (this.#isConversation(normalizedCurrentInput)) {
            return "conversation";
        };

        // 🔹 Queries que requieren datos reales (tools)
        return "execution";
    };

    #isConversation(text) {
        return (
            this.#isGreeting(text) ||
            this.#isInstruction(text) ||
            this.#isSmallTalk(text)
        );
    };

    #isGreeting(text) {
        const greetings = [ "hola", "buenas", "hey", "nombre", "soy", "eres" ];

        return greetings.some(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'i');
            return regex.test(text);
        });
    };

    #isInstruction(text) {
       const instructions = ["no me escribas", "a partir de ahora", "responde en"];
        return instructions.some(inst => text.includes(inst));
    };

    #isSmallTalk(text) {
        // Lista de palabras que NUNCA deben ser consideradas small talk
        const executionKeywords = ["día", "hoy", "clima", "precio", "stock", "cuánto", "dónde", "cuándo"];
        
        const hasExecutionWord = executionKeywords.some(word => text.includes(word));
        
        // Si tiene una palabra clave, NO es small talk, es ejecución
        if (hasExecutionWord) return false;

        return text.length < 7;
    };
};
