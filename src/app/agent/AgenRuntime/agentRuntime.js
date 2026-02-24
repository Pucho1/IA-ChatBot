
/**
 * Inicializa estado

    Controla loop

    Incrementa step

    Valida límites

    Procesa decisión

    Decide cuándo terminar

    Guarda historial
 */
const MAX_STEPS = 20;

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

    constructor({ ngine, tools, maxSteps = 8 }) {
        this.ngine    = ngine;
        this.tools    = tools;
        this.maxSteps = maxSteps;
    };

    createInitialState(goal) {
        return {
            goal,                     // El objetivo que el agente debe cumplir, se le pasa al inicio y es lo que guía su comportamiento.
            status: "idle",           // Estado inicial del agente, se actualiza a "running" cuando comienza el loop
            step: 0,                  // Paso actual del agente, se incrementa en cada iteración del loop
            maxSteps: this.maxSteps,  // Pasos máximos permitidos
            history: [],              // Historial de decisiones y observaciones para mantener el contexto
            lastDecision: null,       // Última decisión tomada por el LLM
            lastObservation: null,    // Última observación resultante de ejecutar la decisión
            error: null,              // Información de error en caso de fallo
            startedAt: Date.now(),    // Timestamp de inicio para calcular duración total
            finishedAt: null          // Timestamp de finalización
        };
    };


    run = async (goal) => {  

        const state = this.createInitialState(goal);
        state.status = "running";

        try {
            while(this.shouldContinue(state)) {
                state.step++;

                const decision = await this.ngine.step(state);  // llamas a tu capa de Cognición (Planner) devuelve una decision que puede ser usar una herramienta o finalizar con una respuesta.
                state.lastDecision = decision;

                const observation = await this.processDecision(decision, state); // (Executor) procesa la decision, si es una decision de tipo "tool" ejecuta la herramienta y devuelve el resultado, si es una decision de tipo "final" devuelve la respuesta final.
                state.lastObservation = observation;

                // Historial: Se guarda un registro de "Paso 1: Decidí esto -> Observé aquello". Esto es lo que permite que en el paso 2, la IA sepa lo que hizo en el 1.
                state.history.push({
                    step: state.step,
                    decision,
                    observation,
                    timestamp: Date.now()
                });
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
     * Traducir la "voluntad" del LLM en una "acción" concreta. Si el LLM decide usar una herramienta, aquí es donde se ejecuta esa herramienta y se devuelve el resultado. Si el LLM decide finalizar, aquí es donde se devuelve la respuesta final.
     * @param {*} decision 
     * @returns 
     */
    async processDecision(decision, state) {
        if (decision.type === "final"){
            state.status = "completed";

            return { done: true, output: decision.output };
        };

        if (decision.type === "tool"){ // Si la decisión es usar una herramienta, ejecutamos esa herramienta y devolvemos el resultado.
            const tool = this.tools[decision.tool];

            // Validación de seguridad: Nos aseguramos de que la herramienta que el LLM quiere usar está en nuestra lista de herramientas permitidas.
            //  Esto es crucial para evitar que el LLM ejecute código malicioso o acceda a datos sensibles.
            if(!tool) { 

                // Si la herramienta no existe, el estado debería fallar
                state.status = "failed";
                throw new Error(`Tool ${decision.tool} not found`);
            };

            // Aquí es donde realmente se ejecuta la herramienta. Esto puede ser una consulta a una base de datos, una llamada a una API externa, 
            // o cualquier otra cosa que tu agente necesite hacer para cumplir su objetivo.
            const result  = await tool(...decision.args);
            return { done: false, result };
        };

        throw new Error(`Unknown decision type: ${decision.type}`);
    };

    /**
     *  Construye la respuesta final que se le va a devolver al usuario.
     * @param {*} state 
     * @returns 
     */
    buildResponse(state) {
        const duration  = state.finishedAt - state.startedAt; // Es vital para telemetría y saber si tu agente es lento.

        return{
            // El agente se considera exitoso si llega a una decisión final antes de alcanzar el límite de pasos.
            //  Si alcanza el límite de pasos sin llegar a una decisión final, se considera que no tuvo éxito.
            success: state.status === "completed" || state.status === "max_steps" 
            ? false 
            : state.status === "completed",

            output:  state.lastDecision?.type === "final"
                ? state.lastDecision.output
                : null,
            error: state.error,
            metadata:{
                duration: duration,
                steps: state.step,
                status: state.status
            }
        };
    };
};


   // for (let step = 0; step < MAX_STEPS; step++) {

        //     decision = planner.decide(state);

        //     executor.execute(decision);

        //     update(state);
        // };