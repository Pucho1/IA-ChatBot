// DEFAULT RULES (GOAL → CAPABILITIES)
const DEFAULT_GOAL_CAPABILITY_RULES = [
    {
        name: "booking",
        matches: [/reserv/i],
        capabilities: ["selection_done", "booking_done"],
    },
    {
        name: "flight_search",
        matches: [/vuelo/i],
        capabilities: ["options_presented"],
    },
    {
        name: "date_lookup",
        matches: [/dia/i, /fecha/i],
        capabilities: ["date_obtained"],
    },
    {
        name: "time_lookup",
        matches: [/hora/i],
        capabilities: ["time_obtained"],
    },
    {
        name: "weather_lookup",
        matches: [/clima/i, /tiempo\s+meteorologico/i],
        capabilities: ["weather_obtained"],
    },
];


// DEFAULT CAPABILITY CHECKS
const DEFAULT_CAPABILITY_CHECKS = {

    // Usuario ha seleccionado una opción
    selection_done: (state) =>
        Boolean(state.context?.selected),

    // Se han mostrado opciones al usuario
    options_presented: (state) =>
        Array.isArray(state.context?.options) &&
        state.context.options.length > 0,

    // Reserva completada
    booking_done: (state) =>
        state.history?.some(entry =>
            entry.decision?.tool === "bookFlight" &&
            entry.observation?.success === true
        ) ?? false,

    // Fecha obtenida
    date_obtained: (state) =>
        state.history?.some(entry =>
            entry.decision?.tool === "getCurrentDate" &&
            entry.observation?.success === true
        ) ?? false,

    // Hora obtenida
    time_obtained: (state) =>
        state.history?.some(entry =>
            entry.decision?.tool === "getCurrentTime" &&
            entry.observation?.success === true
        ) ?? false,

    // Clima obtenido
    weather_obtained: (state) =>
        state.history?.some(entry =>
            entry.decision?.tool === "getWeather" &&
            entry.observation?.success === true
        ) ?? false,
};



/**
 * Comprueba si el estado del agente satisface las capacidades requeridas por
 * su objetivo, usando reglas configurables y resultados de herramientas.
 */
export class GoalVerifier {
    /**
     * Configura las comprobaciones de capacidades y las reglas que relacionan
     * objetivos con capacidades. Las opciones recibidas amplian o reemplazan
     * las comprobaciones predeterminadas.
     * @param {object} options Configuracion opcional del verificador.
     */
    constructor({
        capabilityChecks = {},
        goalCapabilityRules = DEFAULT_GOAL_CAPABILITY_RULES,
        registry = null,
    } = {}) {
        this.capabilityChecks = {
            ...DEFAULT_CAPABILITY_CHECKS,
            ...capabilityChecks,
        };

        this.goalCapabilityRules = goalCapabilityRules;
        this.registry = registry;
    }

    /** Verifica el objetivo y devuelve si se cumple junto a sus faltantes. */
    async verify({ state }) {
        const capabilities = this.#getRequiredCapabilities(state);

        // ⚠️ NO fallback mágico
        if (capabilities.length === 0) {
            return {
                success: this.#hasSuccessfulExecution(state),
                missing: [],
            };
        }

        return this.#checkCapabilities(capabilities, state);
    }

    /** Obtiene capacidades explicitas o inferidas a partir del objetivo. */
    #getRequiredCapabilities(state) {
        if (Array.isArray(state.requiredCapabilities)) {
            return this.#unique(state.requiredCapabilities);
        }

        const goal = this.#normalizeText(state.goal);

        const matchedRules = this.goalCapabilityRules.filter(rule =>
            rule.matches.some(pattern => pattern.test(goal))
        );

        const capabilities = matchedRules.flatMap(rule => rule.capabilities);

        return this.#unique(capabilities);
    }

    /** Evalua todas las capacidades y recopila las que aun no se cumplen. */
    #checkCapabilities(capabilities, state) {
        const results = capabilities.map(capability => ({
            capability,
            success: this.#checkSingle(capability, state),
        }));

        console.log("----Capability check results -----", {
            capabilities,
            results,
        });

        const missing = results
            .filter(r => !r.success)
            .map(r => r.capability);

        return {
            success: missing.length === 0,
            missing,
        };
    }

    /** Comprueba una capacidad con su regla o mediante capacidades del registry. */
    #checkSingle(capability, state) {
        const check = this.capabilityChecks[capability];

        if (!check) {
            return state.history?.some(entry =>
                entry.observation?.success === true &&
                this.registry?.getExecutionCapabilities(entry.decision?.tool)
                    .includes(capability)
            ) ?? false;
        }

        return Boolean(check(state));
    }

    #hasSuccessfulExecution(state) {
        return state.planGraph?.steps?.some(step =>
            step.status === "completed"
        ) ?? false;
    }

    /** Expone las capacidades requeridas y las que faltan para el planner. */
    capabilitiesStatus(state) {
        const required = this.#getRequiredCapabilities(state);

        if (required.length === 0) {
            return {
                required: [],
                missing: ["no_capabilities_defined"],
            };
        }

        const { missing } = this.#checkCapabilities(required, state);

        return {
            required,
            missing,
        };
    }

    /** Elimina valores vacios y capacidades duplicadas. */
    #unique(items) {
        return [...new Set(items.filter(Boolean))];
    }

    /** Normaliza un objetivo para compararlo con las reglas configuradas. */
    #normalizeText(text) {
        return String(text || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }
};
