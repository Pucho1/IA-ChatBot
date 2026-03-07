
import { llmClient } from "../llm/llmClinet";


export class AgentEngine {
    constructor({ memory, tools }) {
        this.memory = memory;
        this.tools = tools;
    };

    /**
     * Ejecuta un paso del agente, generando una decisión basada en el estado actual.
     * @param {*} state El estado actual del agente, que incluye el objetivo, el historial de acciones, etc.
     * @returns
     */
    async step(state) {
        const conversationalState = this.memory.getState();
   
        const toolManifest = this.tools.getToolManifest();

        // construyo el prompt con la memoria, que incluye el historial de mensajes, herramientas disponibles, etc.
        const prompt = this.buildPrompt(state, conversationalState);

        // console.log("el manifesto de herramientas que se le pasa al LLM es este: ", toolManifest);

        const llmResponse = await llmClient().complete(
            {
                messages: prompt, // construyo el prompt con la memoria y se lo paso al LLM, espero su respuesta
                temperature: 0.7,
                tools: toolManifest
            }
        );

        console.log("Respuesta cruda del LLM: ", llmResponse.choices[0]);

        // Eeste mensaje puede ser de dos tipos (1) una respuesta final con un mensaje de texto,
        //  o (2) una decisión de usar una herramienta con el nombre de la herramienta y los argumentos para esa herramienta.
        const message = llmResponse.choices[0].message;

        console.log("Mensaje procesado del LLM: ", message.tool_calls);

        // 🔹 TOOL CALLS
        if (message.tool_calls?.length > 0) {

            const toolCalls = message.tool_calls.map(call => {
                // normalización del nombre
                const name = call.function.name.split(".").pop();
                return  {
                    id: call.id,
                    name,
                    args: JSON.parse(call.function.arguments || "{}") // parseamos los argumentos de la herramienta, que vienen como string, a un objeto para poder usarlos luego al ejecutar la herramienta.
                };
            });

            // Si es generatePlan → devolver tipo plan
            // el nombre de la erramienta cuando es un plan sera siempre generatePlan, el LLM lo llama así en el prompt,
            // entonces aquí lo verificamos para saber si es un plan o una llamada a herramienta normal.
            if (toolCalls.length === 1 && toolCalls[0].name === "generatePlan") {

                console.log("LLM ha decidido generar un plan con los siguientes pasosasdasdasdasdasd--------->>>>>>:", toolCalls);

                // Los argumentos de generatePlan deben tener una estructura específica, 
                // que es un array de pasos, cada paso con un nombre de herramienta y sus argumentos.
                const args = toolCalls[0].args;

                if (!args.steps || !Array.isArray(args.steps)) {
                    return {
                        type: "error",
                        output: "Invalid plan structure returned by model"
                    };
                };

                return {
                    type: "plan",
                    plan: args,
                };
            };

            return {
                type: "tool",
                toolCalls,
            };
        };

        // 🔹 FINAL ANSWER
        if (message.content) {
            return { type: "final", output: message.content };
        };

        return {
            type: "error",
            output: "Invalid model response",
        };
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
               You are an autonomous AI agent.

                You may respond with ONE of the following structured decisions:

                If no tool is required, provide the final answer.
                
                2) Tool execution
                Use tool calling.

                Rules:
                - Use exact tool names
                - Return only the tool call when generating a plan
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
};
