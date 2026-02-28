
import { llmClient } from "../llm/llmClinet";
import { extractJSON } from "../sanyty/verifyJsonResponse";


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

        const toolManifest = this.tools.getToolManifest(); // Le pasamos al LLM la lista de herramientas disponibles para que pueda decidir cuál usar. Esto es crucial para que el LLM tome decisiones informadas y no intente usar herramientas que no existen.

        // construyo el prompt con la memoria, que incluye el historial de mensajes, herramientas disponibles, etc.
        const prompt = this.buildPrompt(state, conversationalState);

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

        // 🔹 TOOL CALLS
        if (message.tool_calls?.length > 0) {
            return {
                type: "tool",
                toolCalls: message.tool_calls.map(call => ({
                    id: call.id,
                    name: call.function.name,
                    args: JSON.parse(call.function.arguments)
                }))
            };
        };

        // 🔹 FINAL ANSWER
        if (message.content) {
            return { type: "final", output: message.content };
        };

        return {
            type: "error",
            output: "Invalid model response"
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

                console.log("Tool calls para el paso --------------->", h.step, ":", assistantMessage.tool_calls);
                console.log("Resultados de herramientas para el paso ----------->", h.step, ":", toolMessages);

                return [assistantMessage, ...toolMessages];
            }
            return [];
        });


        const systemMessage = {
            role: "system",
            content: `
                You are an autonomous AI agent.
                If a tool is required to achieve the goal, call the tool.
                If no tool is required, provide the final answer.                
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


    /**
     *  Limpia y valida la respuesta del LLM, asegurándose de que sea un JSON válido y manejando errores de formato. Esto es crucial para evitar que el agente falle debido a respuestas mal formateadas del LLM, lo cual es común cuando el LLM no sigue estrictamente las instrucciones o cuando hay ruido en la generación.
     * @param {*} rawResponse 
     * @returns 
     */
    #clearResponse(rawResponse) {  
        const cleanedResponse = extractJSON(rawResponse);

        if (!cleanedResponse) {
            console.error("No se encontró JSON válido");
            return new Response("Model format error", { status: 500 });
        };

        // try{
        //     clearLlmOutput = JSON.parse(cleanedResponse); // esto puede traer un error de formato devido a la respuesta dda por la IA
        // } catch(error){
        //     // deberia tratar este error 
        //     console.error("La IA envió basura, intentando limpiar...");
        //     return new Response("Invalid JSON from LLM", { status: 500 });
        // };

        return JSON.parse(cleanedResponse);
    };
};
