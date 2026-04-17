import { BehaviorManager } from "../behavior/BehaviorManager";
import { ReferenceResolver } from "../cognition/reference/ReferenceResolver";
import { TransitionResolver } from "../cognition/transition/TransitionResolver";
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

    constructor({ 
        engine, 
        registry, 
        router, 
        argumentNormalizer, 
        argumentResolver, 
        intentClassifier, 
        memory,
    }) {
        this.engine             = engine;
        this.registry           = registry;
        this.router             = router;
        this.argumentNormalizer = argumentNormalizer;
        this.missingInfoGuard   = new MissingInfoGuard();
        this.argumentResolver   = argumentResolver;
        this.classifier         = intentClassifier;
        this.memory             = memory;
        this.behaviorManager    = new BehaviorManager();
        this.referenceResolver  = new ReferenceResolver();
        this.transitionResolver = new TransitionResolver();
    };

    /**
     * Orquestar el proceso global y mantener métricas del sistema.
     * @param {*} goal
     * @returns
     */
    run = async (state) => {

        // Inicializo el contexto de referencia y el estado del agente. El contexto de referencia es 
        // crucial para que el agente pueda entender a qué se refiere el usuario
        // con términos como "esto", "lo anterior", etc., 
        // lo cual es fundamental para mantener una conversación coherente y relevante.
        state.context = {
           ...state.context,
            reference: null,
        };

        // El estado del agente se inicializa con la información proporcionada, 
        // y se establece el status en "running" para indicar que el agente está activo y procesando la solicitud.
        state.status = "running";


        // 🔹 ROUTING (ANTES DE PLANIFICAR) elijo si es una conversacion o necesito ejecutar una herramienta. 
        // ---Intent = significado lingüístico---  /// Intent dice: qué quiere el usuario
        const interpretation = await this.classifier.getIntent(state.currentInput, state);
        
        // 🔹 ResolverReference antes de planificar elijo si es una referencia.
        // ---Referencia = significado contextual---  /// ResolverReference dice: a qué se refiere el usuario con eso, este, lo anterior, etc.
        const reference = this.referenceResolver.resolve({
            input: state.currentInput,
            state,
        });

        // 🔹 Transition dice: qué hago ahora
        const transition = this.transitionResolver.resolve({
            intent: interpretation,
            reference,
            state,
        });

        console.log("Resultado del TransitionResolver =======>", transition );
        console.log("interpretacion de ResolverReference =======>", reference );

        if (transition.type === "SELECT_OPTION") {
            state.context.selected = reference.value;
            state.context.skipSearch = true;
        };

        const isContinuationResetet = {
            ...interpretation,
            isContinuation: state.goal === null ? false : interpretation.isContinuation,
        };

        const route = await this.router.route(isContinuationResetet);

        console.log("interpretacion de la intencion del usuario segun el clasificador =======>", interpretation, {isContinuationResetet} );
        console.log("Routing decision:", route);

        // si es un cambio de objetivo limpio el plan anterior para que no me genere incoherencias y
        // le doy el nuevo objetivo como norte a mi agente
        if (transition.shouldResetGoal) {
            console.log("Detectado cambio de objetivo. Limpiando plan anterior...");

            state.goal = state.currentInput; // El nuevo input es el nuevo norte
            state.planGraph = null;          // Forzamos al Engine a crear un plan nuevo
            state.status = "idle";           // Volvemos al estado inicial de planificación
            state.step = 0;                  // Reseteamos el contador de pasos
            // Mantenemos state.history o state.facts si queremos que el agente 
            // recuerde lo anterior, pero el PLAN específico se borra.
        };

        if (isContinuationResetet.intent === "meta_instruction") {

            this.behaviorManager.process(state.currentInput, state);

            const statusPLanIsComplete = state.planGraph?.isComplete() ?? false;

            state.planGraph = statusPLanIsComplete ? null : state.planGraph;
            state.goal = statusPLanIsComplete ? null : state.goal;

            // state.status = "completed";
            state.finishedAt = Date.now();
            state.metadata={
                duration: state.finishedAt - state.startedAt,
                steps: state.step,
                status: state.status,
                metrics: state.metrics,
            };
            state.error = null;

            // Podríamos ser más específicos en la respuesta, indicando qué meta-instruction se aplicó
            //  y cómo afectará el comportamiento del agente.
            return this.buildResponse(state, "Entendido.");
        };

        state.status = state.status === "idle" ? "running" : state.status; // Si estaba idle por un cambio de objetivo, lo ponemos a running para que siga el proceso normal.

        console.log("Estado inicial del agente:", state);

        const requiresTools = route === "execution";

        // Router decide que no se requieren herramientas, genero respuesta final directa sin pasar por el loop de planificación y ejecución."
        if (!requiresTools) {

            const response = await this.engine.generateFinalAnswer({
                goal: state.goal,
                history: state.history,
                state,
            });

            state.status = "completed";
            state.finishedAt = Date.now();
            state.metadata={
                duration: state.finishedAt - state.startedAt,
                steps: state.step,
                status: state.status,
                metrics: state.metrics,
            };
            state.error = null;

            return this.buildResponse(state, response);
        };

        // try {
        while(this.shouldContinue(state)) {
            state.step++;

            /**
             * 1️⃣ Si no hay plan → generarlo
             */
            if (!state.planGraph) {

                const plan = await this.engine.generatePlan({
                    state,
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

            console.log("estos son los pasos ejecutables que tengo de mi plan ==============>>>>", {executableSteps})

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
                        history: state.history,
                        state,
                    });


                    console.log("esta es la rtespuesta final del agente------>", output)

                    const goalSatisfied = await this.verifyGoal(state, { output });

                    if (goalSatisfied) {

                        console.log("!!!----Goal verificado como cumplido. Finalizando agente...-----!!!");
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
                    // state.planGraph = null;
                    state.status = "replanning";
                    console.log(" ⚠️⚠️⚠️ Plan completo pero goal NO cumplido → REPLAN ⚠️⚠️⚠️");
                    continue;
                };

                /**
                 * Plan bloqueado → replanning
                 */
                // state.planGraph = null;
                state.status = "waiting_for_input";
                continue;
            };

            /**
             * 4️⃣ Ejecutar pasos
             */
            for (const step of executableSteps) {

                // lopaso antes a pendinete de ejecucion si estaba bloqueado
                //  --- esto lo pudoiera hacer direcrtamente en el hrahp porque si estas ejecutable es que eres pending
                if (step.status === "blocked") {
                    state.planGraph.markPending(step.id);
                };

                state.planGraph.markRunning(step.id);

                const tool      = this.registry.get(step.tool);
                const args      = step.args; // cada paso del plan generado por el llm tiene unos argumentos requeridos. argumeto del llm segun la tool enviada
                const schema    = tool.schema; // de la tool saco el schema como fuente de la verdad de los arg que realmennte definio la herramienta 


                // normalizo los datos de los argumentos por si traen errores
                // ---- cambio los nombres de los ar por los reales
                const normalizedArgs = await this.argumentNormalizer.normalize({
                    args,
                    schema,
                });

                // me sercioro de que todos los argumento necesarios para que se eejcute la erramienta esten.
                // veo que esten todos
                const guardResult = this.missingInfoGuard.check({ args: normalizedArgs, schema  });

                console.log("argumento de detect missing fields======>>>>>", { guardResult })

                // que no este ninguno vacio  y como no vuekvoi a generar el plan tengo que buscar dentro de mi contexto qu debe incluir 
                // lo nuevo escrito por e user 
                const { resolvedArgs, missingFields } = await this.argumentResolver.resolve({
                    args: normalizedArgs,
                    schema,
                    state,
                });

                console.log("argumento resuletos y campos faltantes =======>", {resolvedArgs}, {missingFields})

                if(resolvedArgs){
                    step.args = resolvedArgs;
                };
                
                let observation;

                // si faltan datos en la respuesta del llm porque el user no los dio se deben pedir nuevamente
                if (missingFields.length > 0 ) {

                    const question = await this.engine.generateMoreDataQuestion({
                        goal: state.goal,
                        missingFields,
                    });

                    observation = {
                        type: "blocked",
                        success: true,
                        result: question,
                        error: null,
                        missingFields,
                        done: false
                    };
                } else {

                    state.planGraph.updateStepArgs(step.id, resolvedArgs);

                    const toolResult = await this.executeTool(
                        { ...step, args: resolvedArgs },
                        step.id
                    );
                    
                    // 🧠 INTERACTION GATING (GENÉRICO)
                    if (Array.isArray(toolResult.result) && toolResult.result.length > 1) {

                        // guardo opciones en contexto
                        state.context.options = toolResult.result;

                        const selectionQuestion = await this.engine.generateSelectionQuestion({
                            goal: state.goal,
                            options: toolResult.result,
                        });

                        // a futuro esto no me conviene ya que una herramienta puede devolver una lista 
                        // pero no necesariamente es para que el usuario elija una opción, 
                        // puede ser simplemente una lista de resultados.
                        observation = {
                            type: "selection_required",
                            success: true,
                            result: selectionQuestion,
                            raw: toolResult.result,
                            missingFields: ["selection"],
                            done: false,
                        };

                    } else {
                        observation = {
                            type: toolResult.success ? "success" : "error",
                            ...toolResult,
                            missingFields: [],
                        };
                    }
                };

                console.log("este es el resultado de ejecutar la erramienta o el resultado si fallo algo dentro de los parametro necesarios para ello =====>", observation);

                let shouldStopExecution = false;
                // manejo el estado en el que esta mi paso segun el rsultado de la ejecucion
                //  de mi errramienta o de mi decicion
                if (observation.type === "blocked") {
                    state.planGraph.markBlocked(step.id, observation.missingFields);
                    state.status = "waiting_for_input";
                    shouldStopExecution = true;
                };

                if (observation.type === "selection_required") {
                    state.planGraph.markCompleted(step.id, observation.raw);

                    state.context.options = observation.raw;
                    state.context.awaitingSelection = true;

                    state.status = "waiting_for_input";
                    shouldStopExecution = true;
                }

                if (observation.type === "success") {
                    state.planGraph.markCompleted(step.id, observation.result);
                };

                if (observation.type === "error") {
                    state.planGraph.markFailed(step.id, observation.error);
                    state.status = "replanning";
                    state.metrics.totalErrors++;
                    state.planGraph = null;
                    shouldStopExecution = true;
                };

                state.metrics.toolCalls++;

                const record = this.#createStepRecord(state, step, observation);
                state.history.push(record);

                // 🔥 Corto la ejecucion para no seguir con mas pasos.
                if (shouldStopExecution) {
                    break;
                };
            };
        };

        /**
         * Si alcanzamos límite de pasos
         */
        if(state.step >= state.maxSteps && state.status === "running") {
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
                tool: decision.tool,
                type: decision.type,
                description: decision.description ?? null,
                toolCalls: decision.result ?? [],
                row: decision.raw ?? null,
                args: decision.args ?? {},
                output: decision.output ?? null
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
    buildResponse(state, response) {
        const duration  = state.finishedAt - state.startedAt; // Es vital para telemetría y saber si tu agente es lento.
        const lastStep = state.history[state.history.length - 1];

        // Esto es oro puro para debugging. Te muestra exactamente qué pasó durante la ejecución del agente.
        console.log("Estado final del agente:", {state}, {lastStep}, {response});

        const output = response ? response : state.status === "waiting_for_input"  ? lastStep?.observation?.toolResults : lastStep?.decision?.output ?? null;
            
        this.memory.addAssistantResponse(output); // guardo la respuesta final del agente en la memoria

        // Actualizo la última interacción en el estado para que el clasificador de intención tenga acceso a ella en la próxima iteración.  
        state.lastInteraction = {
            text: output,
            source: "system",
            timestamp: Date.now()
        };

        return{
            // El agente se considera exitoso si llega a una decisión final antes de alcanzar el límite de pasos.
            //  Si alcanza el límite de pasos sin llegar a una decisión final, se considera que no tuvo éxito.
            success: state.status === "completed",
            output: output, 
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
