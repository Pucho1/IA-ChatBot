/** Extrae preferencias y las convierte en instrucciones de prompt. */
export class BehaviorManager {

    /** Extrae y guarda las reglas detectadas en el estado. */
    process(input, state) {
        if (!state.behaviorRules) {
            state.behaviorRules = {
                structured: [],
                raw: []
            };
        };

        const extracted = this.#extractRules(input);

        // Guardar reglas estructuradas
        if (extracted.structured.length > 0) {
            state.behaviorRules.structured.push(...extracted.structured);
        };

        // Guardar reglas no estructuradas
        if (extracted.raw.length > 0) {
            state.behaviorRules.raw.push(...extracted.raw);
        };

        console.log("steate antes de extraer reglas para saber si se inserto las propiedades a behaviorRules --------->", state);

    };

    /** Extrae reglas mediante heuristicas, sin usar el LLM. */
    #extractRules(input) {
        const structured = [];
        const raw = [];

        const text = input.toLowerCase();

        // 🔹 max_words
        const maxWordsMatch = text.match(/(\d+)\s+palabras/);
        if (maxWordsMatch) {
            structured.push({
                key: "max_words",
                value: parseInt(maxWordsMatch[1])
            });
        };

        // 🔹 estilo conciso
        if (text.includes("corto") || text.includes("breve")) {
            structured.push({
                key: "style",
                value: "concise"
            });
        };

        // 🔹 fallback → si no detecta nada estructurado
        if (structured.length === 0) {
            raw.push(input);
        };

        return { structured, raw };
    };

    /** Convierte las reglas guardadas en instrucciones para el prompt. */
    buildPromptInstructions(state) {

        console.log("state.behaviorRules en buildPromptInstructions -------->>>>>>", state?.behaviorRules);
        if (!state.behaviorRules) return "";

        const { structured, raw } = state.behaviorRules;

        const instructions = [];

        for (const rule of structured) {
            if (rule.key === "max_words") {
                instructions.push(`Respond in less than ${rule.value} words.`);
            }

            if (rule.key === "style" && rule.value === "concise") {
                instructions.push(`Be concise.`);
            }
        }

        // Añadimos reglas libres (raw)
        for (const r of raw) {
            instructions.push(r);
        }

        return instructions.join("\n");
    };
};
