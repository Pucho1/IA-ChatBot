import { llmClient } from "@/app/llm/llmClinet";

export class Planer {
    constructor({ tools }) {
        this.tools = tools;
    };

    async generatePlan(messages) {
        const toolManifest = this.tools.getToolManifest(); // Obtiene la descripción de las herramientas disponibles

        // Construye el prompt con el estado actual, la memoria y las herramientas.
        const prompt = this.buildPrompt(state, memoryState, toolManifest); 

        const response = await llmClient().complete({
            temperature: 0,
            messages: prompt,
        });

        const message = response.choices[0].message?.content;

        if (!message) {
            throw new Error("Planner returned empty response");
        };

        let plan;

        try {
            plan = JSON.parse(message);
        } catch (err) {
            throw new Error("Planner returned invalid JSON");
        };

        if (!plan.steps || !Array.isArray(plan.steps)) {
            throw new Error("Planner response missing steps array");
        };

        return plan;
    };


    buildPrompt(state, memoryState, toolManifest) {
        
        const toolDescriptions = toolManifest
            .map(t => `- ${t.function.name}: ${t.function.description}`)
            .join("\n")
        ;

        const systemMessage = {
            role: "system",
            content: `
            You are an AI planning system.

            Your task is to convert a user goal into a structured execution plan.

            The plan must be returned as valid JSON.

            Rules:
            - Use ONLY available tools.
            - Each step must reference a valid tool.
            - Steps may belong to execution groups.
            - Steps with the same group may be executed in parallel.
            - Groups must be executed in ascending order.
            - Do not execute tools. Only plan them.

            Return ONLY JSON.

            Plan format:

            {
            "steps": [
                {
                "id": number,
                "description": string,
                "tool": string,
                "args": object,
                "group": number
                }
            ]
            }
        `
        };

        const toolsMessage = {
            role: "system",
            content: `
                AVAILABLE TOOLS:

                ${toolDescriptions}
            `
        };

        return [
            systemMessage,
            goalMessage,
            toolsMessage,
        ];
    };
};