import { BehaviorManager }      from "../behavior/BehaviorManager";
import { GoalVerifier }         from "../cognition/goal/GoalVerifier";
import { ReferenceResolver }    from "../cognition/reference/ReferenceResolver";
import { TransitionResolver }   from "../cognition/transition/TransitionResolver";
import { Executor }             from "../execution/Executor";
import { MissingInfoGuard }     from "../execution/missingInformationHandler/detectMissingFields";
import { PlanGraph }            from "../execution/PlanGraph";

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
        this.goalVerifier       = new GoalVerifier({ engine });
        this.Executor           = new Executor(this.registry);
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

        state.context = {
           ...state.context,
            reference: null,
        };

        // Establesco el status en "running" para indicar que el agente está activo y procesando la solicitud.
        state.status = "running";


        // 🔹 ROUTING (ANTES DE PLANIFICAR) elijo si es una conversacion o necesito ejecutar una herramienta. 
        // ---Intent = significado lingüístico---  /// Intent dice: qué quiere el usuario
        const interpretation = await this.classifier.getIntent(state.currentInput, state);

        // 🔹 Elijo la ruta que voy a seguir según la interpretación de la intención del usuario.
        const route = await this.router.route(interpretation);
        
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

        console.log("interpretacion de ResolverReference =======>", reference );
        console.log("Resultado del TransitionResolver =======>", transition );

        if (transition.type === "SELECT_OPTION") {
            state.context.selected = reference.value;
            state.context.skipSearch = true;
            state.context.awaitingSelection = false;
        };


        console.log("interpretacion de la intencion del usuario segun el clasificador =======>", interpretation );
        console.log("Routing decision:", route);
        console.log("Estado inicial del agente:", state);


        // 🔹 Reseteo el plan ya que he cambiado de Goal
        if (transition.shouldResetGoal) {
            console.log("Detectado cambio de objetivo. Limpiando plan anterior...");

            state.goal = state.currentInput; // El nuevo input es el nuevo norte
            state.planGraph = null;          // Forzamos al Engine a crear un plan nuevo
            state.status = "idle";           // Volvemos al estado inicial de planificación
            state.step = 0;                  // Reseteamos el contador de pasos
        };

        // 🔹Nuevas instrucciones de comportamiento para el llm respuesta final directa.
        if (interpretation.intent === "meta_instruction") {

            this.behaviorManager.process(state.currentInput, state);

            const statusPLanIsComplete = state.planGraph?.isComplete() ?? false;

            state.planGraph = statusPLanIsComplete ? null : state.planGraph;
            state.goal = statusPLanIsComplete ? null : state.goal;

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

        const requiresTools = route === "execution";

        // 🔹No requiero herramintas respuesta final directa.
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

                const capabilities = this.goalVerifier.capabilitiesStatus(state);

                // → 🔥 Interpreto el goal para capabilities.
                const hasRequirements = capabilities.required && capabilities.required.length > 0;
                const nothingMissing = !capabilities.missing || capabilities.missing.length === 0;

                console.log("----Verificación de capacidades para el goal actual -----", capabilities);

                if (hasRequirements && nothingMissing) {

                    console.log("No missing capabilities → skipping planning");

                    state.status = "completed";

                    const output = await this.engine.generateFinalAnswer({
                        goal: state.goal,
                        history: state.history,
                        state,
                    });

                    const record = this.#createStepRecord(
                        state,
                        { type: "final", output },
                        { success: true, done: true }
                    );

                    state.history.push(record);

                    break; // 🔥 salir del loop
                };

                const plan = await this.engine.generatePlan({
                    state,
                    history: state.history,
                    registry: this.registry,
                    mode: state.isReplanning ? "replan" : "initial",
                    executionState: this.buildExecutionState(state),
                    capabilities,
                });

                console.log("Plan generado:", plan);

                // 🔴 VALIDACIÓN CRÍTICA ---> adicionar capa de validacion para el plan generado.
                if (plan.steps.length === 0) {

                    console.log("Plan inválido: se requieren tools");

                    state.isReplanning = true;

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
                // analizar si la validacion del plan no se deberia hacer en planGrahp 
                // el tienen lo necesartio para saber si es un plan valido o no.

                state.isReplanning = false;

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

                    const verification  = await this.goalVerifier.verify({ state });

                    console.log("----Goal verification -----", {verification});
                    

                    if (verification.success ) {

                        console.log("!!!----Goal verificado como cumplido. Finalizando agente...-----!!!", {verification});
                        state.status = "completed";

                        // Como no tengo mas pasos y el el plan esta completado genero respuesta final.
                        const output = await this.engine.generateFinalAnswer({
                            goal: state.goal,
                            history: state.history,
                            state,
                        });

                        console.log("esta es la rtespuesta final del agente------>", output);


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
                    state.isReplanning = true;
                    console.log(" ⚠️⚠️⚠️ Plan completo pero goal NO cumplido → REPLAN ⚠️⚠️⚠️");
                    continue;
                };

                /**
                 * Plan bloqueado → replanning
                 */
                state.status = "waiting_for_input";
                continue;
            };

            /**
             * 4️⃣ Ejecutar pasos
             */
            for (const step of executableSteps) {

                if (step.status === "blocked") {
                    state.planGraph.markPending(step.id);
                };

                state.planGraph.markRunning(step.id);

                const tool      = this.registry.get(step.tool);
                const args      = step.args; 
                const schema    = tool.schema; // de la tool saco el schema como fuente de la verdad de los arg que realmennte definio la herramienta 


                // normalizo los datos de los argumentos por si traen errores
                // ---- cambio los nombres de los ar por los reales
                const normalizedArgs = await this.argumentNormalizer.normalize({
                    args,
                    schema,
                });

                // me sercioro de que todos los argumentos necesarios para que se ejecute la herramienta esten.
                const guardResult = this.missingInfoGuard.check({ args: normalizedArgs, schema  });

                console.log("argumento de detect missing fields======>>>>>", { guardResult })

                // que no este ninguno vacio y como no vuelvo a generar el plan tengo que buscar dentro de mi contexto qu debe incluir 
                // lo nuevo escrito por el user 
                const { resolvedArgs, missingFields } = await this.argumentResolver.resolve({
                    args: normalizedArgs,
                    schema,
                    state,
                    memory: this.memory,
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
                        success: false,
                        result: question,
                        error: null,
                        missingFields,
                        done: false
                    };
                } else {

                    state.planGraph.updateStepArgs(step.id, resolvedArgs);

                    const toolResult = await this.Executor.executeTool(
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
                    state.isReplanning = true;
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

        return {
            step: state.step,
            decision: {
                tool: decision.tool || null,
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
     *  Construye la respuesta final que se le va a devolver al usuario.
     * @param {*} state
     * @returns
     */
    buildResponse(state, response) {
        const duration  = state.finishedAt - state.startedAt; // Es vital para telemetría y saber si tu agente es lento.
        const lastStep = state.history[state.history.length - 1];

        console.log("Estado final del agente:", {state}, {lastStep}, {response});

        const output = this.#handleOutput(response, state, lastStep);
            
        this.memory.addAssistantResponse(output); // guardo la respuesta final del agente en la memoria

        // Actualizo la última interacción en el estado para que el clasificador de intención tenga acceso a ella en la próxima iteración.  
        state.lastInteraction = {
            text: output,
            source: "system",
            timestamp: Date.now()
        };

        return{
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

    #handleOutput(response, state, lastStep) {

        if(response) return response;

        if(state.status === "waiting_for_input" ) {
            return lastStep?.observation?.toolResults;
        };

        return lastStep?.decision?.output ?? null;
    };

    /**
     * Construye el estado de ejecución que se le va a pasar al motor de planificación y ejecución del agente.
     *  Este estado incluye información sobre los pasos completados, los pasos fallidos, 
     *  si hay una selección pendiente por parte del usuario, y los datos disponibles en el contexto.
     *  Es crucial para que el motor pueda tomar decisiones informadas sobre qué hacer a continuación.
     * @param {*} state 
     * @returns 
     */
    buildExecutionState(state) {
        return {
            completedSteps: state.history
            .filter(h => h.observation.success)
            .map(h => ({
                tool: h.decision.tool,
                args: h.decision.args,
                result: h.observation.toolResults,
            })),

            failedSteps: state.history
            .filter(h => !h.observation.success),

            hasSelection: !!state.context.selected,

            availableData: {
                selected: state.context.selected,
                options: state.context.options,
            }
        };
    };
};
