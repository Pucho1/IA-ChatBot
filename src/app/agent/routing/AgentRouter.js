export class AgentRouter {

    route(goal) {

        if (!goal || typeof goal !== "string") {
            return "execution";
        };

        const g = goal.toLowerCase();

        // 🔹 Conversacional / instrucciones
        if (
            g.includes("hola") ||
            g.includes("gracias") ||
            g.includes("a partir de ahora") ||
            g.includes("no me escribas") ||
            g.includes("responde") ||
            g.includes("mi nombre")

        ) {
            return "conversation";
        }

        // 🔹 Queries que requieren datos reales (tools)
        if (
            g.includes("fecha") ||
            g.includes("día") ||
            g.includes("hoy") ||
            g.includes("reservame") ||
            g.includes("hora")
        ) {
            return "execution";
        };

        // 🔹 Default
        return "execution";
    }
};
