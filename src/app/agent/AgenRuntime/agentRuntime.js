import { llmClient } from "@/app/llm/llmClinet";

/**
 * Inicializa estado

    Controla loop

    Incrementa step

    Valida límites, goal, errores

    Procesa decisión

    Decide cuándo terminar

    Guarda historial
 */
export class AgentRuntime {

    constructor({ engine, tools, maxSteps = 8 }) {
        this.engine   = engine;
        this.tools    = tools;
        this.maxSteps = maxSteps;
    };

    /**
     * Maneja el input del usuario, lo guarda en la memoria y luego inicia el proceso del agente con ese input como objetivo.
     * @param {*} userInput 
     * @returns 
     */
    async handlerUserInput(userInput) {
        await this.engine.memory.handlerUserInput(userInput); // guardo el input del usuario en la memoria

        const state = this.createInitialState(userInput);

        const runtimeOutput = await this.#run(state);

        this.engine.memory.addAssistantResponse(runtimeOutput.output); // guardo la respuesta final del agente en la memoria

        return runtimeOutput;
    };

    createInitialState(goal) {
        return {
            goal,                     // El objetivo que el agente debe cumplir, se le pasa al inicio y es lo que guía su comportamiento.
            plan: null,                // El plan que el agente genera para cumplir su objetivo.
            status: "idle",           // idle | running | completed | failed | max_steps
            step: 0,                  // Paso actual del agente, se incrementa en cada iteración del loop
            maxSteps: this.maxSteps,  // Pasos máximos permitidos
            history: [],              // Historial de decisiones y observaciones para mantener el contexto y Fuente única de verdad
            error: null,              // Información de error en caso de fallo
            startedAt: Date.now(),    // Timestamp de inicio para calcular duración total
            finishedAt: null,          // Timestamp de finalización
            metrics: {
                totalErrors: 0,
                toolCalls: 0
            },
            retryCount: 0,
            maxRetries: 1,
        };
    };

    /**
     * Orquestar el proceso global y mantener métricas del sistema.
     * @param {*} goal
     * @returns
     */
    #run = async (state) => {

        state.status = "running";

        // Muy útil para debugging, te muestra con qué estado inicial está trabajando el agente.
        console.log("Estado inicial del agente:", state);

        // try {
            while(this.shouldContinue(state)) {
                state.step++;

                if(state.plan){
                    // const step = state.plan.steps.find(step => step.status === "pending");
                    const step = state.plan.steps[state.plan.currentStep];

                    // Si no hay más pasos → pedir final al modelo
                    if (!step) {
                        const decision = await this.engine.step(state);


                        if (decision.type === "final") {
                            state.status = "completed";

                            // Si el modelo devuelve una decisión de tipo "final" después de completar el plan, 
                            // entonces consideramos que el agente ha cumplido su objetivo con éxito.
                            // decimos que el objetvo se cumpio y exitosamente. 
                            const observation = {
                                toolResults: [], // no hay, porque no se ejecuto ninguna erramienta.
                                done: true, // se cunplio el objetivo, entonces done es true.
                                success: true, // la ejecución del plan fue exitosa, entonces success es true.
                            };

                            const record = this.#createStepRecord(state, decision, observation);

                            state.history.push(record);

                            // El agente ha completado su plan y ha llegado a una respuesta final, marcamos como completado.
                            break;
                        };

                        // Si el modelo no devuelve final después de completar el plan, es un error de contrato.
                        state.status = "failed";
                        state.error = "Model did not return final after plan completion";
                        break;
                    };

                    // Creo un id sintetico para cada paso del plan.
                    const syntheticId = `plan_${state.step}_${step.id}`;

                    const toolCallDecision = {
                        type: "tool",
                        output: null,
                        toolCalls: [
                            {
                                id: syntheticId,
                                name: step.tool,
                                args: step.args
                            }
                        ]
                    };

                    // si no es final → ejecuto el paso del plan, que es una llamada a herramienta.
                    const observation = await this.executeTool(step, syntheticId);

                    const record = this.#createStepRecord(state, toolCallDecision, observation);
                    state.history.push(record);

                    if (!observation.success) {
                        state.plan = null;
                        continue;
                    };

                    state.plan.currentStep++;
                    continue;
                };

                const decision = await this.engine.step(state);  // llamas a tu capa de Cognición (Planner) devuelve una decision que puede ser usar una herramienta o finalizar con una respuesta.

                if (decision.type === "plan") {
                    console.log("paso:" + state.step + " El modelo ha devuelto un plan:-------->", decision.plan); // Esto es oro puro para debugging. Te muestra exactamente qué plan ha generado el modelo, lo cual es crucial para entender cómo el modelo está abordando el problema y por qué tomó ciertas decisiones en pasos posteriores.
                    
                    state.plan = {
                        steps: decision.plan.steps,
                        currentStep: 0,
                    };
                    const record = this.#createStepRecord(
                        state,
                        { type: "plan", output: null, toolCalls: [] },
                        { success: true, toolResults: [], done: false }
                    );

                    state.history.push(record);

                    continue;
                };

                const observation = await this.processDecision(decision, state); // (Executor) procesa la decision, si es una decision de tipo "tool" ejecuta la herramienta y devuelve el resultado, si es una decision de tipo "final" devuelve la respuesta final.
                
                console.log("paso:" + state.step + " Observación después de procesar la decisión:-------->", observation); // Esto es oro puro para debugging. Te muestra exactamente qué observación resultó de procesar la decisión del modelo, lo cual es crucial para entender cómo el agente está interactuando con su entorno y por qué tomó ciertas decisiones en pasos posteriores.
                
                // Métricas
                if (decision.type === "tool") {
                    state.metrics.toolCalls++;
                };

                if (!observation.success) {
                    state.metrics.totalErrors++;
                };

                const stepRecord = this.#createStepRecord(state, decision, observation);
                state.history.push(stepRecord);

                if (observation.done) {
                    state.status = "completed";
                    break;
                };
            };

            // Si llegamos al límite de pasos sin haber completado, marcamos como max_steps
            if(state.step >= this.maxSteps && state.status === "running") { 
                state.status = "max_steps";
            };

        // } catch (error) {
        //     state.status = "failed";
        //     state.error = error.message || "Unknown error";
        // };

        state.finishedAt = Date.now();

        return this.buildResponse(state);
    };

    /**
     *  Ejecuta una herramienta específica con los argumentos proporcionados.
     *  Esto es crucial para que el agente pueda interactuar con su entorno y obtener la información
     *  o realizar las acciones necesarias para cumplir su objetivo.
     * @param {*} step
     * @param {*} syntheticId
     * @returns
     */
    async executeTool(step, syntheticId) {

        try {
            const result = await this.tools.execute(step.tool, step.args);
            return {
                id: syntheticId,
                success: true,
                result,
                done: false,
                error: null,
            };

        } catch (error) {
            return {
                id: syntheticId,
                success: false,
                error: error.message || "Unknown error",
                done: false,
                result: null,
            };
        };
    };

    /**
     * Segun el estado determina si continua o no el loop.
     * @param {*} state 
     * @returns boolean
     */
    shouldContinue(state) {
        return (
            state.status === "running" &&
            state.step < state.maxSteps
        );
    };


    /**
     * Traducir la "voluntad" del LLM en una "acción" concreta. 
     * Si el LLM decide usar una herramienta, aquí es donde se ejecuta esa herramienta y se devuelve el resultado. 
     * Si el LLM decide finalizar, aquí es donde se devuelve la respuesta final.
     * @param {*} decision 
     * @returns 
     */
    async processDecision(decision, state) {

        console.log("Procesando decisión:--------------->", decision); 

        if (decision.type === "final"){

            const goalSatisfied = await this.verifyGoal(state, decision);

            console.log("¿Se cumplió el objetivo según la verificación--------->", goalSatisfied);

            if (goalSatisfied) {
                state.status = "completed";
                return {
                    done: true,
                    output: decision.output,
                    toolResults: null,
                    error: "Goal not complete",
                    success: true,
                };
            };

            // GOAL NO CUMPLIDO → REPLAN
            state.plan = null;

            return {
                done: false,
                output: null,
                success: false,
                toolResults: null,
                error: "Goal not satisfied. Replanning required.",
            };
        };

        // Si la decisión es usar una herramienta, ejecutamos esa herramienta y devolvemos el resultado.
        if (decision.type === "tool") {

            const toolResults = [];

            for (const tool of decision.toolCalls) {

                // Si la herramienta no existe, devolvemos un error específico para esa herramienta, 
                // pero seguimos ejecutando el resto de herramientas si es que hay más en la misma decisión.
                if (!this.tools.has(tool.name)) { 
                    toolResults.push({
                        id: tool.id,
                        success: false,
                        error: `Tool ${tool.name} not found`,
                        result: null,
                    });
                    continue;
                };

                // Aquí es donde realmente se ejecuta la herramienta. Esto puede ser una consulta a una base de datos, una llamada a una API externa, 
                // o cualquier otra cosa que tu agente necesite hacer para cumplir su objetivo.
                try {
                    const result = await  this.tools.execute(tool.name, tool.args);

                    console.log(`Resultado de ejecutar la herramienta "${tool.name}":`, result); // Esto es oro puro para debugging. Te muestra exactamente qué resultado obtuvo el agente al ejecutar la herramienta, lo cual es crucial para entender cómo el agente está interactuando con su entorno y por qué tomó ciertas decisiones en pasos posteriores.

                    toolResults.push({
                        id: tool.id,
                        success: true,
                        result,
                        error: null
                    });

                    state.metrics.toolCalls++;

                } catch (error) {
                    toolResults.push({
                        id: tool.id,
                        success: false,
                        result: null,
                        error: error.message
                    });

                    state.metrics.totalErrors++;
                };
            };

            return {
                success: toolResults.every(r => r.success),
                done: false,
                toolResults,
                output: null,
                error: null,
            };
        };

        return {
            success: false,
            done: false,
            error: `Unknown decision type: ${decision.type}`,
            toolResults: null,
            output: null,
        };
    };

    /**
     * creo un registro estructurado de cada paso del agente, que incluye la decisión tomada, la observación 
     * resultante y el estado actual del agente. Esto es crucial para mantener un historial detallado de lo que hizo el agente 
     * en cada paso, lo cual es invaluable para debugging, análisis posterior y para que el agente mismo pueda aprender
     *  de su experiencia en iteraciones futuras.
     * @param {*} state estado actual del anegente.
     * @param {*} decision deciciosn tomada para este paso.
     * @param {*} observation observacion del resultado de la decicion.
     * @returns 
     */
    #createStepRecord(state, decision, observation) {
        return {
            step: state.step,
            decision: {
                type: decision.type,
                output: decision.output ?? null,
                toolCalls: decision.toolCalls ?? []
            },
            observation: {
                success: observation.success ?? false,
                toolResults: observation.toolResults ?? [],
                done: observation.done ?? false
            },
            timestamp: Date.now(),
        };
    };

    /**
     * Verifica si el goal se cumplió satisfactoriamente. 
     * Esto es especialmente importante para tareas complejas donde el agente necesita usar herramientas
     * para obtener información o realizar acciones, y no es suficiente con simplemente devolver una respuesta final.
     * @param {*} state 
     * @param {*} decision 
     * @returns boolean
     */
    async verifyGoal(state, decision) {

        // conversación simple el goal se cumple siempre.
        if (state.metrics.toolCalls === 0) {
            return true;
        };

        // Si el agente ha hecho llamadas a herramientas y no hay output en la decisión final,
        // entonces consideramos que el goal no se cumplió.
        if (!decision.output) {
            return false;
        };

        // Si hay errores en las llamadas a herramientas,
        // consideramos que el goal no se cumplió, aunque el modelo haya devuelto una respuesta final.
        if (state.metrics.totalErrors > 0) {
            return false;
        };

        const prompt = [
            {
                role: "system",
                content: "You are evaluating whether an AI agent successfully completed a goal."
            },
            {
                role: "user",
                content: `
                Goal:
                ${state.goal}

                Agent Output:
                ${decision.output}

                Did the agent accomplish the goal?

                Answer ONLY with YES or NO.
                `
            },
        ];

        const response = await llmClient().complete({
            messages: prompt,
            temperature: 0,
        });

        console.log("Respuesta del LLM para verificación de gooooooooooooooal: ", response.choices[0].message.content); // Esto es oro puro para debugging. Te muestra exactamente qué respuesta dio el modelo al evaluar si el objetivo se cumplió o no, lo cual es crucial para entender cómo el modelo está interpretando el éxito del agente y por qué podría estar dando ciertas respuestas en pasos posteriores.

        const answer = response.choices[0].message.content.trim().toUpperCase();

        return answer.includes("YES");
    };

    /**
     *  Construye la respuesta final que se le va a devolver al usuario.
     * @param {*} state
     * @returns
     */
    buildResponse(state) {
        const duration  = state.finishedAt - state.startedAt; // Es vital para telemetría y saber si tu agente es lento.
        const lastStep = state.history[state.history.length - 1];

        // Esto es oro puro para debugging. Te muestra exactamente qué pasó durante la ejecución del agente.
        console.log("Estado final del agente:", state); 
       
        return{
            // El agente se considera exitoso si llega a una decisión final antes de alcanzar el límite de pasos.
            //  Si alcanza el límite de pasos sin llegar a una decisión final, se considera que no tuvo éxito.
            success: state.status === "max_steps" 
            ? false 
            : state.status === "completed",

            output:  lastStep?.decision?.output ?? null,
            error: state.error,
            metadata:{
                duration,
                steps: state.step,
                status: state.status,
                metrics: state.metrics,
            },
        };
    };
};
