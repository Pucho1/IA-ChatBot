import { llmClient } from "@/app/llm/llmClinet";
import { PlanGraph } from "../execution/PlanGraph";
import { MissingInfoGuard } from "../execution/misinInformationHandler/detectMissingFields";

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

    constructor({ engine, registry, maxSteps = 8, router, argumentNormalizer }) {
        this.engine   = engine;
        this.registry = registry;
        this.maxSteps = maxSteps;
        this.router   = router;
        this.argumentNormalizer = argumentNormalizer;
        this.missingInfoGuard = new MissingInfoGuard();
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
            planGraph : null,               // El plan que el agente genera para cumplir su objetivo.
            status    : "idle",           // "idle" | "planning" | "executing" | "observing" | "evaluating" | "replanning" | "completed"
            step      : 0,                  // Paso actual del agente, se incrementa en cada iteración del loop
            maxSteps  : this.maxSteps,  // Pasos máximos permitidos
            history   : [],              // Historial de decisiones y observaciones para mantener el contexto y Fuente única de verdad
            error     : null,              // Información de error en caso de fallo
            startedAt : Date.now(),    // Timestamp de inicio para calcular duración total
            finishedAt: null,         // Timestamp de finalización
            metrics   : {
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

        console.log("Estado inicial del agente:", state);

        // 🔹 ROUTING (ANTES DE PLANIFICAR) elijo si es una concersacon o nocesito ejecutar una erramienta.
        const route = this.router.route(state.goal, state);

        const requiresTools = route === "execution";

        console.log("Routing decision:", route);

        // Router decide "si ejecutar"
        if (!requiresTools) {

            const output = await this.engine.generateFinalAnswer({
                goal: state.goal,
                history: state.history,
            });

            state.status = "completed";
            state.finishedAt = Date.now();

            return {
                success: true,
                output,
                error: null,
                metadata: {
                    duration: state.finishedAt - state.startedAt,
                    steps: state.step,
                    status: state.status,
                    metrics: state.metrics,
                },
            };
        };

        // flujo de ejecuccion puede que necesite erraminetas
        // try {
            while(this.shouldContinue(state)) {
                state.step++;

                /**
                 * 1️⃣ Si no hay plan → generarlo
                 */
                if (!state.planGraph) {

                    const plan = await this.engine.generatePlan({
                        goal: state.goal,
                        history: state.history,
                        registry: this.registry,
                    });

                    console.log("Plan generado:", plan);

                    // 🔴 VALIDACIÓN CRÍTICA
                    if (plan.steps.length === 0) {

                        console.log("Plan inválido: se requieren tools");

                        state.status = "replanning";

                        // OPCIÓN 1 (simple)
                        // forzar reintento con contexto extra

                        state.retryCount++;

                        if (state.retryCount > state.maxRetries) {
                            state.status = "failed";
                            state.error = "Planner failed to generate executable plan";
                            break;
                        };

                        continue;
                    };

                    state.planGraph = new PlanGraph(plan.steps);

                    continue;
                };

                /**
                 * 2️⃣ Obtener pasos ejecutables
                 */
                const executableSteps = state.planGraph.getExecutableSteps();

                /**
                 * 3️⃣ Si no hay pasos ejecutables
                 */
                if (executableSteps.length === 0) {

                    /**
                    * Plan terminado
                    */
                    if (state.planGraph.isComplete()) {

                        // Como no tengo mas pasos y el el plan esta completado genero respuesta final.
                        const output = await this.engine.generateFinalAnswer({
                            goal: state.goal,
                            history: state.history
                        });


                        console.log("esta es la rtespuesta final del agente------>", output)

                        const goalSatisfied = await this.verifyGoal(state, { output });

                        if (goalSatisfied) {

                            state.status = "completed";

                            const record = this.#createStepRecord(
                                state,
                                { type: "final", output },
                                { success: true, done: true }
                            );

                            state.history.push(record);

                            break;
                        };

                        /**
                         * Goal no cumplido → replanning
                         */
                        state.planGraph = null;
                        state.status = "replanning";
                        continue;
                    };

                    /**
                     * Plan bloqueado → replanning
                     */
                    state.planGraph = null;
                    state.status = "replanning";
                    continue;
                    
                };

                /**
                 * 4️⃣ Ejecutar pasos
                 */
                for (const step of executableSteps) {

                    state.planGraph.markRunning(step.id);

                    const tool      = this.registry.get(step.tool);
                    const args      = step.args;
                    const schema    = tool.schema;


                    // normalizo los datos de los argumentos por si traen errores
                    const normalizedArgs = await this.argumentNormalizer.normalize({
                        args,
                        schema,
                    });

                    // me sercioro de que todoso los argumento necesarios para que se eejcute la erramienta esten.
                    const guardResult = this.missingInfoGuard.check({ args: normalizedArgs, schema  });

                    console.log("argumento de detect missing fields======>>>>>", { guardResult })
                    let observation;

                    // si faltan datosen la respust del llm porque el user no los dio los dio se deben pedir nuevamente

                    if (guardResult.blocked) {

                        const question = await this.engine.generateMoreDataQuestion({
                            goal: state.goal,
                            missingFields: guardResult.missingFields
                        });

                        observation = {
                            type: "blocked",
                            success: true,
                            result: question,
                            error: null,
                            missingFields: guardResult.missingFields,
                            done: false
                        };
                    } else {
                        const toolResult = await this.executeTool(
                            { ...step, args: normalizedArgs },
                            step.id
                        );

                        observation = {
                            type: toolResult.success ? "success" : "error",
                            ...toolResult,
                            missingFields: []
                        };
                    };

                    console.log("este es el resultado de ejecutar la erramienta o el resultado si fallo algo dentro de los parametro necesarios para ello =====>", observation);

                    // si la observacion es satisfactoria la marco como completada.
                    if (observation.type === "blocked") {
                        state.planGraph.markBlocked(step.id, observation.missingFields);
                        state.status = "waiting_for_input";
                        // break;
                    };

                    if (observation.type === "success") {
                        state.planGraph.markCompleted(step.id, observation.result);
                    };

                    if (observation.type === "error") {
                        state.planGraph.markFailed(step.id, observation.error);
                        state.status = "replanning";
                        state.metrics.totalErrors++;
                        state.planGraph = null;
                        // break;
                    };


                    state.metrics.toolCalls++;

                    const record = this.#createStepRecord(state, step, observation);
                    state.history.push(record);
                };
            };

            /**
             * Si alcanzamos límite de pasos
             */
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
            const result = await this.registry.execute(step.tool, step.args);

            return {
                id: syntheticId,
                success: true,
                result,
                done: false, // ??
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

        console.log("esta es la observation y la decicion que guardo ----->", observation, decision)
        return {
            step: state.step,
            decision: {
                type: decision.type,
                output: decision.output ?? null,
                toolCalls: decision.toolCalls ?? []
            },
            observation: {
                success: observation.success ?? false,
                toolResults: observation.result ?? [],
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

        console.log("decicion ------------>", decision)

        // Si el agente ha hecho llamadas a herramientas y no hay output en la decisión final,
        // entonces consideramos que el goal no se cumplió.
        // if (!decision.output) {
        //     return false;
        // };

        // const prompt = [
        //     {
        //         role: "system",
        //         content: "You are evaluating whether an AI agent successfully completed a goal."
        //     },
        //     {
        //         role: "user",
        //         content: `
        //         Goal:
        //         ${state.goal}

        //         Agent Output:
        //         ${decision.output}

        //         Did the agent accomplish the goal?

        //         Answer ONLY with YES or NO.
        //         `
        //     },
        // ];

        // const response = await llmClient().complete({
        //     messages: prompt,
        //     temperature: 0,
        // });

        // console.log("Respuesta del LLM para verificación de gooooooooooooooal: ", response.choices[0].message.content); // Esto es oro puro para debugging. Te muestra exactamente qué respuesta dio el modelo al evaluar si el objetivo se cumplió o no, lo cual es crucial para entender cómo el modelo está interpretando el éxito del agente y por qué podría estar dando ciertas respuestas en pasos posteriores.

        // const answer = response.choices[0].message.content.trim().toUpperCase();

        // return answer.includes("YES");
        return !!decision.output;
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
        console.log("Estado final del agente:", state, lastStep);
       
        return{
            // El agente se considera exitoso si llega a una decisión final antes de alcanzar el límite de pasos.
            //  Si alcanza el límite de pasos sin llegar a una decisión final, se considera que no tuvo éxito.
            success: state.status === "completed",
            output:  state.status === "waiting_for_input"  ? lastStep?.observation?.toolResults : lastStep?.decision?.output ?? null ,
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
