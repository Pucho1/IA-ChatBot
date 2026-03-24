import routes from "./routesTypes"

export class AgentRouter {

    route(goal, state) {
        console.log(routes);

        const normalizedGoal = goal.toLowerCase().trim();
        const statusBlocked  = "waiting_for_input";

        // 🔹 1. conversación básica
        if (this.#isConversation(normalizedGoal) && state.status !== statusBlocked ) {
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
        return [ "hola", "buenas", "hey", "nombre", "soy", "eres" ].some(word => text.includes(word));
    };

    #isInstruction(text) {
        return (
            text.includes("no me escribas") ||
            text.includes("a partir de ahora") ||
            text.includes("responde en")
        );
    };

    #isSmallTalk(text) {
        return text.length < 15;
    };
};
