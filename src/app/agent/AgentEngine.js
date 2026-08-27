import { llmClient } from "../llm/llmClinet";
import { BehaviorManager } from "./behavior/BehaviorManager";

/**
 * Coordina las interacciones entre la memoria, el registro de herramientas y
 * el modelo de lenguaje. Genera planes de ejecucion, preguntas intermedias y
 * respuestas finales para las distintas fases del agente.
 */
export class AgentEngine {
    /**
     * Inicializa el motor con la memoria de la sesion. La memoria se utiliza
     * para incorporar mensajes, hechos y resumenes a los prompts enviados al LLM.
     * @param {{memory: object}} params Dependencias del motor.
     */
    constructor({ memory }) {
        this.memory = memory;
        this.behaviorManager = new BehaviorManager();
    };

    /**
     * Solicita al LLM un plan mediante la herramienta cognitiva `generatePlan`.
     * Valida que la respuesta contenga pasos, argumentos JSON correctos y solo
     * herramientas de ejecucion registradas.
     * @param {object} params Estado, registro, modo y capacidades del plan.
     * @returns {Promise<object>} Plan validado con su lista de pasos.
     * @throws {Error} Si el LLM devuelve una respuesta o plan invalido.
     */
    async generatePlan({ state, history, registry, mode, executionState, capabilities }) {

        const conversationalState = this.memory.getState();

        const prompt = this.buildPlannerPrompt(state, registry, conversationalState, mode, executionState, capabilities);

        const tools = registry.getCognitiveManifest();
   
        const llmResponse = await llmClient().complete(
            {
                messages: prompt,
                temperature: 0,
                tools,
                // DeepSeek v4 Flash rejects a forced function in thinking mode.
                // The system prompt requires this tool and the response is checked below.
                toolChoice: {
                    type: "function",
                    function: { name: "generatePlan" },
                },
            }
        );

        const message = llmResponse.choices[0].message;


        if (!message.tool_calls || message.tool_calls.length === 0) {
            throw new Error("Planner returned empty response");
        };

        const call = message.tool_calls.find(
            toolCall => toolCall.function?.name === "generatePlan"
        );

        if (!call) {
            throw new Error("Planner did not call generatePlan");
        }

        let args;
        try {
            args = JSON.parse(call.function.arguments || "{}");
        } catch {
            throw new Error("Planner returned invalid JSON arguments");
        }

        if (!args.steps || !Array.isArray(args.steps)) {
            throw new Error("Invalid plan structure");
        };

        const invalidTool = args.steps.find(step => !registry.has(step.tool));
        if (invalidTool) {
            throw new Error(`Planner selected an unavailable execution tool: ${invalidTool.tool}`);
        }

        return args;
    };

    /** Genera la respuesta final usando el objetivo, historial y memoria actual. */
    async generateFinalAnswer({ goal, history, state }) {

        const conversationalState = this.memory.getState();

        const prompt = this.buildFinalPrompt(goal, history, conversationalState, state);

        const response = await llmClient().complete({
            messages: prompt,
            temperature: 0.3,
        });

        return response.choices[0].message.content;
    };

    /** Genera una pregunta para solicitar al usuario los campos faltantes. */
    async generateMoreDataQuestion({ goal, missingFields }) {

        const prompt = this.buildRequestDataPrompt(goal, missingFields );

        const response = await llmClient().complete({
            messages: prompt,
            temperature: 0.7,
        });

        return response.choices[0].message.content;
    };


    /** Genera una pregunta para que el usuario elija entre varias opciones. */
    async generateSelectionQuestion({ goal, options }) {

        const prompt = this.buildSelectionPrompt(goal, options);

        console.log("Generando pregunta de selección con las opciones, y con el prompt:", options, prompt);

        const response = await llmClient().complete({
            messages: prompt,
            temperature: 0.7,
        });

        return response.choices[0].message.content;
    };

    /** Envia un prompt de verificacion al LLM y devuelve su respuesta textual. */
    async executeVerificationGoal(prompt) {

        const response = await llmClient().complete({
            messages: prompt,
            temperature: 0.7,
            
        });

        return response.choices[0].message.content;
    };

    /**
     * Construye el prompt de planificacion con el objetivo, capacidades,
     * herramientas disponibles, progreso y contexto conversacional.
     * @returns {Array<object>} Mensajes listos para enviar al LLM.
     */
    buildPlannerPrompt(state, registry, conversationalState, mode, executionState, capabilities) {

        const { messages, facts, summary } = conversationalState;

        const tools = registry.getExecutionManifest();
        const requiredCapabilities = capabilities?.required ?? [];
        const missingCapabilities = capabilities?.missing ?? [];

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

                    =====================
                    CAPABILITY STATUS
                    =====================

                    REQUIRED: ${JSON.stringify(requiredCapabilities)}
                    MISSING: ${JSON.stringify(missingCapabilities)}

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
                    ${this.#extractLastToolResult(state.history)}
                    
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

    /** Construye el prompt de respuesta final con memoria, reglas y resultados. */
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

    /** Construye el prompt que solicita exclusivamente los campos faltantes. */
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

    /** Construye el prompt que presenta opciones y solicita una seleccion. */
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

    /** Extrae del historial las herramientas utilizadas hasta el momento. */
    #extractLastToolResult(history) {
        return history
            .filter(h => h.decision?.tool)
            .map(h => h.decision.tool);
    };
};
