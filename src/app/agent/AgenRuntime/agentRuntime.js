
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

    constructor({ memory, registry, planner, executor }) {
        this.memory     = memory;
        this.registry   = registry;
        this.planner    = planner;
        this.executor   = executor;
    };

    const runtimeSteps = {
        goal: string,
        status: "idle" | "running" | "completed" | "failed" | "max_steps",
        step: number,
        maxSteps: number,
        history: [],
        lastDecision: null,
        lastObservation: null,
        error: null,
        startedAt: number,
        finishedAt: number | null
    };


    run = async (goal) => {    };

};
