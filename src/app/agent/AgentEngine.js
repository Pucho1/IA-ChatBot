
import { resolveAction } from "../actions/actionResolve";
import { llmClient } from "../llm/llmClinet";
import { extractJSON } from "../sanyty/verifyJsonResponse";


export class AgentEngine {
    constructor({ memory, tool }) {
        this.memory = memory;
        this.tool = tool;
    };

    /**
     * Ejecuta un paso del agente, generando una decisión basada en el estado actual.
     * @param {*} state El estado actual del agente, que incluye el objetivo, el historial de acciones, etc.
     * @returns 
     */
    async step(state) {
        await this.memory.handlerUserInput(state.goal); // guardo el input del usuario en la memoria

        const conversationalState = this.memory.getState();

        const toolManifest = this.tool.getToolManifest(); // Le pasamos al LLM la lista de herramientas disponibles para que pueda decidir cuál usar. Esto es crucial para que el LLM tome decisiones informadas y no intente usar herramientas que no existen.

        // construyo el prompt con la memoria, que incluye el historial de mensajes, herramientas disponibles, etc.
        const prompt = this.buildPrompt(state, conversationalState);

        const llmResponse = await llmClient().complete(
            {
                messages: prompt, // construyo el prompt con la memoria y se lo paso al LLM, espero su respuesta
                temperature: 0.7,
                format: "json_object",
                tools: toolManifest
            }
        );

        const cleanedResponse = this.#clearResponse(llmResponse.choices[0].message.content);

        return cleanedResponse; // devuelvo la respuesta del LLM para que el AgentRuntime la procese y decida qué hacer (usar una herramienta, finalizar, etc.)
    };

    async run(userInput) {
        this.memory.handlerUserInput(userInput);// guardo el input del usuario en la memoria

        const toolManifest = this.registry.getToolManifest();

        while(true) {

            const cleanedResponse = extractJSON(llmResponse.choices[0].message.content);

            if (!cleanedResponse) {
              console.error("No se encontró JSON válido");
              return new Response("Model format error", { status: 500 });
            };

            try{
              clearLlmOutput = JSON.parse(cleanedResponse); // esto puede traer un error de formato devido a la respuesta dada por la IA
            } catch(error){ 
              // deberia tratar este error 
              console.error("La IA envió basura, intentando limpiar...");
              return new Response("Invalid JSON from LLM", { status: 500 });
            };

            // Aqui puedo parsear datos antes de resolver la acción, por ejemplo si quiero extraer un json de una respuesta que no esta bien formateada
            const action = resolveAction(clearLlmOutput);

            if(action.type === "tool") {

                this.memory.addToolCall(action.tool, action.args);

                const result = await this.registry.execute(action.tool, action.args);

                this.memory.addToolResult(action.tool, result);

            };

            if(action.type === "final") {

                this.memory.addAssistantResponse(action.content);

                return action.content;
            };
        };
    };


    /**
     * Construye el prompt para el LLM basado en el estado actual del agente y la memoria.
     */
    buildPrompt(runtimeState, conversationalState) {
        const { goal, step, maxSteps, history } = runtimeState;
        const { messages, facts, summary }      = conversationalState;

        const previousActions = history.map(histor => {
            if (histor.decision.type === "tool") {
                return `Tool: ${histor.decision.tool}      Result: ${JSON.stringify(histor.observation?.result)}`
            }
            return ""
        }).join("\n\n");


        const systemMessage = {
            role: "system",
            content: `
                You are an autonomous AI agent.
                You must decide the next action to achieve the goal.
                Respond using tool calls when necessary.
                If the goal is complete, respond with a final answer.
                You must respond ONLY with valid JSON.

                If using a tool:
                {
                    "type": "tool",
                    "tool": "toolName",
                    "args": {}
                }

                If the task is complete or you want to give a final answer:
                {
                    "type": "final",
                    "output": "..."
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

                Previous Actions:
                ${previousActions || "None"}
            `
        };

        

        // return `
        // You are an AI agent designed to achieve a specific goal.
        // You must respond ONLY with valid JSON.

        // === Conversation Summary ===
        // ${summary || "None"}

        // === Known Facts ===
        // ${facts.map(f => "- " + f).join("\n") || "None"}

        // === Recent Messages ===
        // ${messages.map(m => `${m.role}: ${m.content}`).join("\n")}

        // === Agent Goal ===
        // ${goal}

        // === Execution State ===
        // Current Step: ${step} of ${maxSteps}

        // Previous Actions:
        // ${previousActions || "None"}

        // Decide the next action.

        // If using a tool:
        // {
        // "type": "tool",
        // "tool": "toolName",
        // "args": {}
        // }

        // If the task is complete:
        // {
        // "type": "final",
        // "output": "..."
        // }
        // `
        // }

        return [
            systemMessage,
            runtimeMessage,
            ...messages.map(m => ({ role: m.role, content: m.content })),
            // facts.length  > 0  ? facts : {role:"system", content: "No known facts"},
            ...facts,
            ...summary
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
