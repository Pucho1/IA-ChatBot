import { success } from "zod";

/**
 * Inicializa estado

    Controla loop

    Incrementa step

    Valida límites

    Procesa decisión

    Decide cuándo terminar

    Guarda historial
 */
export class AgentRuntime {

    /**
     * estados posibles del runtime
     *  IDLE
        RUNNING
        COMPLETED
        FAILED
        MAX_STEPS_EXCEEDED
        ERROR
     */

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
        };
    };

    // await this.memory.handlerUserInput(state.goal); // guardo el input del usuario en la memoria

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

                console.log(`Paso ${state.step}: Ejecutando paso ${state.step} con estado:`, state); // Esto es oro puro para debugging. Te muestra exactamente qué decisión tomó el agente en cada paso y qué observación obtuvo.

                const decision = await this.engine.step(state);  // llamas a tu capa de Cognición (Planner) devuelve una decision que puede ser usar una herramienta o finalizar con una respuesta.

                console.log(`Paso ${state.step}: Decisión tomada:----------`, decision); // Esto es oro puro para debugging. Te muestra exactamente qué decisión tomó el agente en cada paso, lo cual es crucial para entender por qué el agente tomó cierta acción o por qué falló.

                const observation = await this.processDecision(decision, state); // (Executor) procesa la decision, si es una decision de tipo "tool" ejecuta la herramienta y devuelve el resultado, si es una decision de tipo "final" devuelve la respuesta final.

                console.log(`Paso ${state.step}: Observación obtenida:----------`, observation); // Esto es oro puro para debugging. Te muestra exactamente qué observación obtuvo el agente después de procesar su decisión, lo cual es crucial para entender cómo el agente está interactuando con su entorno y por qué tomó ciertas decisiones en pasos posteriores.
                
                // Métricas
                if (decision.type === "tool") {
                    state.metrics.toolCalls++;
                };

                if (!observation.success) {
                    state.metrics.totalErrors++;
                };

                const stepRecord = {
                    step: state.step,

                    decision: {
                        type: decision.type,
                        output: decision.output ?? null,
                        toolCalls: decision.toolCalls ?? null,
                    },

                    observation: {
                        success: observation.success ?? false,
                        toolResults: observation.toolResults ?? null,
                        done: observation.done ?? false
                    },

                    timestamp: Date.now()
                };

                // Historial: Se guarda un registro de 
                // "Paso 1: Decidí esto -> Observé aquello". Esto es lo que permite que en el 
                // paso 2, la IA sepa lo que hizo en el 1.
                state.history.push(stepRecord);

                if (observation.done) {
                    state.status = "completed";
                    break;
                };
            };

            if(state.step >= this.maxSteps && state.status === "running") { // Si llegamos al límite de pasos sin haber completado, marcamos como max_steps
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
            state.status = "completed";

            return {
                done: true,
                output: decision.output,
                success: true,
            };
        };

        // Si la decisión es usar una herramienta, ejecutamos esa herramienta y devolvemos el resultado.
        if (decision.type === "tool") {

            const toolResults = [];

            for (const tool of decision.toolCalls) {

                if (!this.tools.has(tool.name)) {
                    toolResults.push({
                        id: tool.id,
                        success: false,
                        error: `Tool ${tool.name} not found`,
                        result: null
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
                toolResults
            };
        };

        return {
            success: false,
            done: false,
            error: `Unknown decision type: ${decision.type}`,
        };
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
            success: state.status === "completed" || state.status === "max_steps" 
            ? false 
            : state.status === "completed",

            output:  lastStep?.decision?.type === "final"
                ? lastStep.decision.output
                : null,
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
