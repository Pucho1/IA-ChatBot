
export class TransitionResolver {
    constructor() {};

    resolve({ intent, reference, state }) {

        const hasReference = !!reference;

        const hasBlockedSteps = state.planGraph?.steps?.some(s => s.status === "blocked");

        // El agente detecta que el usuario ha proporcionado información relevante para desbloquear 
        // pasos bloqueados en su plan actual.
        const providesData = intent.intent === "provide_info";


        // El agente ya tiene un objetivo activo, lo que significa que está en medio de la
        //  ejecución de un plan para cumplir ese objetivo.
        const hasActiveGoal = !!state.goal;

        const isUserContinuingFlow =  hasActiveGoal && intent.isContinuation;

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
