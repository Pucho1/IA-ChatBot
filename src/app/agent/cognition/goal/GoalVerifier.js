// ===============================
// DEFAULT RULES (GOAL → CAPABILITIES)
// ===============================
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


// ===============================
// DEFAULT CAPABILITY CHECKS
// ===============================
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


// ===============================
// GOAL VERIFIER
// ===============================
export class GoalVerifier {
    constructor({
        capabilityChecks = {},
        goalCapabilityRules = DEFAULT_GOAL_CAPABILITY_RULES,
    } = {}) {
        this.capabilityChecks = {
            ...DEFAULT_CAPABILITY_CHECKS,
            ...capabilityChecks,
        };

        this.goalCapabilityRules = goalCapabilityRules;
    }

    /**
     * Verifica si el goal se ha cumplido
     */
    async verify({ state }) {
        const capabilities = this.#getRequiredCapabilities(state);

        // ⚠️ NO fallback mágico
        if (capabilities.length === 0) {
            return {
                success: false,
                missing: ["no_capabilities_defined"],
            };
        }

        return this.#checkCapabilities(capabilities, state);
    }

    /**
     * Devuelve capacidades requeridas para el goal
     */
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

    /**
     * Evalúa todas las capacidades
     */
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

    /**
     * Evalúa una sola capability
     */
    #checkSingle(capability, state) {
        const check = this.capabilityChecks[capability];

        if (!check) {
            console.warn(`⚠️ Unknown capability: ${capability}`);
            return false;
        }

        return Boolean(check(state));
    }

    /**
     * API pública para planner/runtime
     */
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

    /**
     * Utils
     */
    #unique(items) {
        return [...new Set(items.filter(Boolean))];
    }

    #normalizeText(text) {
        return String(text || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }
};
