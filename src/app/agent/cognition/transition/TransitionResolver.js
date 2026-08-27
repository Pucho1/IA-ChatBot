
/**
 * Determina la transicion que debe aplicar el agente despues de interpretar
 * un mensaje del usuario.
 *
 * Las transiciones se evalúan en orden de prioridad: seleccion de una opcion,
 * aporte de datos faltantes, inicio de una nueva tarea y, como ultimo caso,
 * una entrada irrelevante para el flujo actual.
 */
export class TransitionResolver {

    /**
     * Resuelve la siguiente transicion a partir de la intencion, la referencia
     * contextual y el estado actual del plan.
     *
     * Una referencia siempre tiene prioridad y produce `SELECT_OPTION`. Si no
     * hay referencia, un mensaje `provide_info` con pasos bloqueados produce
     * `FILL_MISSING_DATA`. Una intencion `request_action` que no sea continuacion
     * inicia una tarea nueva. El resto de combinaciones produce `IRRELEVANT`.
     *
     * @param {object} params Parametros de resolucion.
     * @param {object} params.intent Interpretacion de la entrada del usuario.
     * @param {string} params.intent.intent Tipo de intencion detectada.
     * @param {boolean} [params.intent.isContinuation] Indica si continua un flujo.
     * @param {object|null} params.reference Referencia contextual detectada.
     * @param {object} params.state Estado actual del agente.
     * @param {object|null} [params.state.planGraph] Plan actual del agente.
     * @returns {{type: string, shouldResetGoal: boolean, shouldReplan: boolean}}
     *   Transicion resuelta y sus instrucciones para el objetivo y la planificacion.
     */
    resolve({ intent, reference, state }) {

        const hasReference = !!reference;

        const hasBlockedSteps = state.planGraph?.steps?.some(s => s.status === "blocked");

        // El agente detecta que el usuario ha proporcionado información relevante para desbloquear pasos bloqueados en su plan actual.
        const providesData = intent.intent === "provide_info";

        // El agente detecta que el usuario ha hecho una nueva solicitud o pedido,
        // indicando claramente que quiere que el agente realice una acción específica.
        const isNewGoal = intent.intent === "request_action" &&  !intent.isContinuation;


        // 1️⃣ SELECT_OPTION (máxima prioridad)
        if (hasReference) {
            return {
                type: "SELECT_OPTION",
                shouldResetGoal: false,
                shouldReplan: false,
            };
        };

        // 2️⃣ FILL_MISSING_DATA
        if (hasBlockedSteps && providesData) {
            return {
                type: "FILL_MISSING_DATA",
                shouldResetGoal: false,
                shouldReplan: false,
            };
        };

        // 3️⃣ NEW_TASK
        if (isNewGoal) {
            return {
                type: "NEW_TASK",
                shouldResetGoal: true,
                shouldReplan: true,
            };
        };

        // 4️⃣ IRRELEVANT
        return {
            type: "IRRELEVANT",
            shouldResetGoal: false,
            shouldReplan: false,
        };
    };

};
