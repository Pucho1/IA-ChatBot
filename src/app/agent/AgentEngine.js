
import { llmClient } from "../llm/llmClinet";


export class AgentEngine {
    constructor({ memory }) {
        this.memory = memory;
    };

    /**
     * Ejecuta un paso del agente, generando una decisión basada en el estado actual.
     * @param {*} state El estado actual del agente, que incluye el objetivo, el historial de acciones, etc.
     * @returns
     */
    async generatePlan({ goal, history, registry, requiresTools }) {

        const conversationalState = this.memory.getState();

        const prompt = this.buildPlannerPrompt(goal, registry, conversationalState);

        const tools = registry.getCognitiveManifest();
   
        const llmResponse = await llmClient().complete(
            {
                messages: prompt, // construyo el prompt con la memoria y se lo paso al LLM, espero su respuesta
                temperature: 0,
                tools,
                tool_choice: {
                    type: "function",
                    function: { name: "generatePlan" }
                },
            }
        );

        const message = llmResponse.choices[0].message;

        // Eeste mensaje puede ser de dos tipos (1) una respuesta final con un mensaje de texto,
        //  o (2) una decisión de usar una herramienta con el nombre de la herramienta y los argumentos para esa herramienta.
        // const message = extractJSON(llmResponse.choices[0].message.content);

        console.log("Mensaje procesado del LLM: ", message);

        if (!message.tool_calls || message.tool_calls.length === 0) {
            throw new Error("Planner returned empty response");
        };

        const call = message.tool_calls[0];

        const args = JSON.parse(call.function.arguments || "{}");

        if (!args.steps || !Array.isArray(args.steps)) {
            throw new Error("Invalid plan structure");
        };

        return args;
    };

    /**
     * Genera la respuesta final para el usuario.
     */
    async generateFinalAnswer({ goal, history }) {

        const conversationalState = this.memory.getState();

        const prompt = this.buildFinalPrompt(goal, history, conversationalState);

        const response = await llmClient().complete({
            messages: prompt,
            temperature: 0.3,
        });

        return response.choices[0].message.content;
    };


        /**
     * Genera la respuesta final para el usuario.
     */
    async generateMoreDataQuestion({ goal, missingFields }) {

        const prompt = this.buildRequestDataPrompt(goal, missingFields );

        const response = await llmClient().complete({
            messages: prompt,
            temperature: 0.7,
        });

        return response.choices[0].message.content;
    };

    /**
     * Construye el prompt para el LLM basado en el estado actual del agente y la memoria.
     */
    buildPrompt(runtimeState, conversationalState) {

        const { goal, step, maxSteps, history } = runtimeState;
        const { messages, facts, summary }      = conversationalState;

        console.log("paso:" + step + " Construyendo prompt con el siguiente histry del agente:", history);

        const toolSequence = history.flatMap(h => {
            if (h.decision.type === "tool" && h.observation && h.observation?.toolResults) {

                const assistantMessage = {
                    role: "assistant",
                    tool_calls: h.decision.toolCalls?.map(call => ({
                        id: call.id,
                        type: "function",
                        function: {
                            name: call.name,
                            arguments: JSON.stringify(call.args)
                        }
                    }))
                };

                const toolMessages = h.observation.toolResults.map(call => ({
                    role: "tool",
                    tool_call_id: call.id,
                    content: JSON.stringify({
                        success:call.success,
                        result: call.result ?? null,
                        error: call.error ?? null
                    }),
                }));

                return [assistantMessage, ...toolMessages];
            }
            return [];
        });


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

        const runtimeMessage = {
            role: "system",
            content: `
                === Agent Goal ===
                ${goal}

                === Execution State ===
                Current Step: ${step} of ${maxSteps}
            `
        };

        return [
            systemMessage,
            runtimeMessage,
            ...messages.map(m => ({ role: m.role, content: m.content })),
            ...facts,
            ...summary,
            ...toolSequence
        ];
    };

    buildPlannerPrompt(goal, registry, conversationalState) {
        console.log("estos son los argumento que le llegan al build planner promp: ====>", {registry} )

        const { messages, facts, summary } = conversationalState;
        const tools = registry.getExecutionManifest();

        const toolDescriptions = tools
            .map(t => {
                return `
                    Tool: ${t.function.name}
                    Description: ${t.function.description}

                    Parameters:
                    ${JSON.stringify(t.function.parameters, null, 2)}
                `;
            });

        return [
            {
                role: "system",
                content: `
                    You are an AI planning system.

                    Your task is to generate a structured execution plan.

                    IMPORTANT:
                    - You MUST use the generatePlan tool
                    - Do NOT return plain text
                    - Do NOT explain anything

                    Rules:
                    - Use ONLY available tools.
                    - Each step must include: id, description, tool, args, depends_on.
                    - Use correct argument names based on tool definitions.
                    - Do NOT invent parameters.
                    - DO NOT invent values.
                    - If a required parameter is missing → leave it out.

                    CRITICAL RULES FOR TOOLS PARAMS:
                    - If you do NOT have a value for a required parameter, DO NOT include it
                    - NEVER invent placeholder values like "unknown", "Origen", "Destino"
                    - It is better to leave arguments empty than to guess

                    this is the avaible tools:
                    ${toolDescriptions}

                    Generate the plan now.
                `        
            },

            {
                role: "system",
                content: `
                    Goal:
                    ${goal}
                `
            },

            ...messages,
            ...facts,
            ...summary,
            // ...this.#buildToolHistory(history)
        ];
    };

    buildFinalPrompt(goal, history, conversationalState) {
 
        const { messages, facts, summary } = conversationalState;

        const executionSummary = history
            .map(step => JSON.stringify(step))
            .join("\n");

        return [
            {
                role: "system",
                content: `
                    You are an AI assistant.

                    The agent has completed executing a plan.

                    Your task is to provide a clear final answer to the user based on the execution results.
                `
            },

            {
                role: "system",
                content: `Goal: ${goal}`
            },

            {
                role: "system",
                content: `
                Execution history:

                ${executionSummary}
                `
            },

            ...summary,
            ...facts,
            ...messages
        ];
    };


    buildRequestDataPrompt(goal, missingFields) {

        const fieldsText = missingFields.map(f => `- ${f}`).join("\n");

        return [
            {
                role: "system",
                content: `
                    You are an assistant.

                    The system needs more information to execute a task.

                    Missing fields: ${fieldsText}

                    Generate a clear and concise question to ask the user.

                    Rules:
                    - Ask only for missing information
                    - Be concise
                    - Do not invent values
                `
            },

            {
                role: "system",
                content: `User goal: ${goal}`
            },
        ];
    };

    // #buildToolHistory(history) {

    //     return history.flatMap(h => {

    //         if (h.decision.type !== "tool") {
    //             return [];
    //         }

    //         const assistantMessage = {
    //             role: "assistant",
    //             tool_calls: h.decision.toolCalls.map(call => ({
    //                 id: call.id,
    //                 type: "function",
    //                 function: {
    //                     name: call.name,
    //                     arguments: JSON.stringify(call.args)
    //                 }
    //             }))
    //         };

    //         const toolMessages = h.observation.toolResults.map(result => ({
    //             role: "tool",
    //             tool_call_id: result.id,
    //             content: JSON.stringify({
    //                 success: result.success,
    //                 result: result.result ?? null,
    //                 error: result.error ?? null
    //             })
    //         }));

    //         return [assistantMessage, ...toolMessages];
    //     });
    // };
};
