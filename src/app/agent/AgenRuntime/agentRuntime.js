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


    /**
     * Orquestar el proceso global y mantener métricas del sistema.
     * @param {*} goal 
     * @returns 
     */
    run = async (goal) => {

        const state = this.createInitialState(goal);
        state.status = "running";

        // Muy útil para debugging, te muestra con qué estado inicial está trabajando el agente.
        console.log("Estado inicial del agente:", state);


        try {
            while(this.shouldContinue(state)) {
                state.step++;

                console.log(`Paso ${state.step}: Ejecutando paso ${state.step} con estado:`, state); // Esto es oro puro para debugging. Te muestra exactamente qué decisión tomó el agente en cada paso y qué observación obtuvo.

                const decision = await this.engine.step(state);  // llamas a tu capa de Cognición (Planner) devuelve una decision que puede ser usar una herramienta o finalizar con una respuesta.

                const observation = await this.processDecision(decision, state); // (Executor) procesa la decision, si es una decision de tipo "tool" ejecuta la herramienta y devuelve el resultado, si es una decision de tipo "final" devuelve la respuesta final.

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
                        tool: decision.tool ?? null,
                        args: decision.args ?? null,
                        output: decision.output ?? null
                    },

                    observation: {
                        success: observation.success ?? false,
                        result: observation.result ?? null,
                        error: observation.error ?? null,
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

            if(state.step >= this.maxSteps && state.status === "running") {
                state.status = "max_steps";
            };

        } catch (error) {
            state.status = "failed";
            state.error = error.message || "Unknown error";
        };

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

        // console.log("Procesando decisión:--------------->", decision); // Esto es oro puro para debugging. Te muestra exactamente qué decisión está tratando de procesar el agente, lo cual es crucial para entender por qué el agente tomó cierta acción o por qué falló.

        if (decision.type === "final"){
            state.status = "completed";

            return { 
                done: true,
                output: decision.output,
                success: true,
            };
        };

        // Si la decisión es usar una herramienta, ejecutamos esa herramienta y devolvemos el resultado.
        if (decision.type === "tool"){ 
            const tool = this.tools.has(decision.tool);

            // Validación de seguridad: Nos aseguramos de que la herramienta que el LLM quiere usar está en nuestra lista de herramientas permitidas.
            //  Esto es crucial para evitar que el LLM ejecute código malicioso o acceda a datos sensibles.
            if(!tool) {
                // Si la herramienta no existe, el estado debería fallar si quiero que pare el agente,
                //  o simplemente devolver un error en la observación y dejar que el LLM decida qué hacer con ese error 
                // (por ejemplo, intentar otra herramienta o finalizar con un mensaje de error).
                return { 
                    done: false, 
                    error: `Tool ${decision.tool} not found`,
                    success: false,
                };
            };

            // Aquí es donde realmente se ejecuta la herramienta. Esto puede ser una consulta a una base de datos, una llamada a una API externa, 
            // o cualquier otra cosa que tu agente necesite hacer para cumplir su objetivo.
            try {
                const result = await  this.tools.execute(decision.tool, decision.args);

                return {
                    success: true,
                    done: false,
                    result
                };
            } catch (error) {
                return { 
                    done: false,
                    error: error.message || "Unknown error",
                    success: false,
                };
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
