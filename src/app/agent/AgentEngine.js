
import { llmClient } from "../llm/llmClinet";
import { BehaviorManager } from "./behavior/BehaviorManager";

export class AgentEngine {
    constructor({ memory }) {
        this.memory = memory;
        this.behaviorManager = new BehaviorManager();
    };

    /**
     * Ejecuta un paso del agente, generando una decisión basada en el estado actual.
     * @param {*} state El estado actual del agente, que incluye el objetivo, el historial de acciones, etc.
     * @returns
     */
    async generatePlan({ state, history, registry, mode, executionState, capabilities }) {

        const conversationalState = this.memory.getState();

        const prompt = this.buildPlannerPrompt(state, registry, conversationalState, mode, executionState, capabilities);

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
    async generateFinalAnswer({ goal, history, state }) {

        const conversationalState = this.memory.getState();

        const prompt = this.buildFinalPrompt(goal, history, conversationalState, state);

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
     *  Genera una pregunta para que el usuario seleccione una opción de una lista de resultados,
     *  basada en el objetivo del agente y las opciones disponibles.
     * @param {*} param0 
     * @returns 
     */
    async generateSelectionQuestion({ goal, options }) {

        const prompt = this.buildSelectionPrompt(goal, options);

        console.log("Generando pregunta de selección con las opciones, y con el prompt:", options, prompt);

        const response = await llmClient().complete({
            messages: prompt,
            temperature: 0.7,
        });

        return response.choices[0].message.content;
    };

    async executeVerificationGoal(prompt) {

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

    /**
     * Construye el prompt para el LLM basado en el estado actual del agente y la memoria, 
     * específicamente para la fase de planificación.
     * @param {*} state 
     * @param {*} registry 
     * @param {*} conversationalState 
     * @returns 
     */
    buildPlannerPrompt(state, registry, conversationalState, mode, executionState, capabilities) {

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
            }).join("\n\n");
        
        const executionInfo = `
            =====================
            EXECUTION STATE
            =====================

            MODE: ${mode}

            COMPLETED STEPS:
            ${executionState?.completedSteps?.map(s => `- ${s.tool}`).join("\n") || "None"}

            FAILED STEPS:
            ${executionState?.failedSteps?.map(s => `- ${s.tool}`).join("\n") || "None"}

            CONTEXT:
            - Has selection: ${!!executionState?.availableData?.selected}
            - Available options: ${executionState?.availableData?.options?.length || 0}

           CONSTRAINTS:
            - Do NOT repeat completed steps
            - Continue from current progress
            - Do NOT restart the plan
        `;

        return [
            {
                role: "system",
                content: `
                    You are an AI planning system.

                    IMPORTANT:
                    - You MUST use the generatePlan tool
                    - Do NOT return plain text
                    - Do NOT explain anything

                    =====================
                    GOAL
                    =====================

                    ${state.goal}

                    CRITICAL RULES:

                    - Use ONLY available tools.
                    - The goal is complete ONLY when all required capabilities are satisfied
                    - You MUST generate steps to satisfy ALL missing capabilities
                    - Do NOT generate steps for capabilities already satisfied
                    - Capabilities are NOT tools
                    - Capabilities represent system states, NOT executable actions
                    - You MUST ONLY use tools listed in the TOOLS section

                    If MODE is "replan":
                    - Assume previous steps were partially executed
                    - Continue the plan from current state
                    - Focus on completing the goal, not restarting
                    - If one of the new steps depends on a step that was completed, do not include in the dependencies of the current step.

                    ${executionInfo}

                    =====================
                    TOOLS
                    =====================

                    this is the avaible tools:
                    ${toolDescriptions}

                     CRITICAL RULES FOR TOOLS PARAMS:
                    - If you do NOT have a value for a required parameter, DO NOT include it
                    - NEVER invent placeholder values like "unknown", "Origen", "Destino"
                    - It is better to leave arguments empty than to guess

                    - Last tool result:
                    ${this.extractLastToolResult(state.history)}
                    
                    RULE:
                    - Use tools ONLY to achieve the missing capabilities

                    =====================
                    OUTPUT FORMAT
                    =====================

                    You MUST return a valid generatePlan tool call.

                    Plan format:

                    {
                    "steps": [
                        {
                        "id": number,
                        "description": string,
                        "tool": string,
                        "args": object,
                        "depends_on": []
                        }
                    ]
                    }

                    REQUIREMENTS:

                    - The plan MUST be complete (cover all missing capabilities)
                    - The plan MUST be minimal (no unnecessary steps)
                    - Do NOT include explanations
                `        
            },

            ...messages,
            ...facts,
            ...summary,
        ];
    };

    /***
     * Construye el prompt para generar la respuesta final al usuario, 
     * incluyendo un resumen de la ejecución y el comportamiento del agente.
     */
    buildFinalPrompt(goal, history, conversationalState, state) {
 
        const { messages, facts, summary } = conversationalState;
        const behaviorInstructions = this.behaviorManager.buildPromptInstructions(state);

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

            {
                role: "system",
                content: behaviorInstructions
            },

            ...summary,
            ...facts,
            ...messages
        ];
    };

    /**
     *  Construye el prompt para generar una pregunta al usuario solicitando información adicional,
     *  basada en los campos faltantes necesarios para ejecutar una herramienta y el objetivo del agente.
     * @param {*} goal 
     * @param {*} missingFields 
     * @returns 
     */
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

    /**
     *  Construye el prompt para generar una pregunta al usuario solicitando que seleccione una opción de una lista de resultados,
     *  basada en el objetivo del agente y las opciones disponibles.
     * @param {*} goal 
     * @param {*} options 
     * @returns 
     */
    buildSelectionPrompt(goal, options) {

        const optionsText = options.map((item, i) => {
            return `${i + 1}. ${JSON.stringify(item)}`;
        }).join("\n");


        return [
            {
                role: "system",
                content: `
                    You are an assistant.

                    The system has executed a tool that returned multiple options.

                    Available options: ${optionsText}

                    Generate a clear and concise question to ask the user to select one of the options.

                    Rules:
                    - List the options clearly
                    - Ask the user to select one option
                    - Be concise
                `
            },

            {
                role: "system",
                content: `User goal: ${goal}`
            },
        ];
    };

    extractLastToolResult(history) {
        return history
            .filter(h => h.decision?.tool)
            .map(h => h.decision.tool);
    };
};
