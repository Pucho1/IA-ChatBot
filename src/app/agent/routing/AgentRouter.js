
export class AgentRouter {

    async route(interpretation) {
        if (interpretation.intent === "social" || interpretation.intent === "meta_instruction") return "conversation";
        return "execution";
    };
};
