import { llmClient } from "@/app/llm/llmClinet";
import { extractJSON } from "@/app/sanyty/verifyJsonResponse";

export class IntentClassifier {
  async getIntent(input, state) {

    console.log("ultimo mensaje del sistema:", state.lastInteraction );

    const prompt = this.#buildPrompt(input, state);

    try {

      // if (!state.goal) return {
      //   intent: "social",
      //   isContinuation: false,
      //   confidence: 1,
      //   source: "no_goal_fallback",
      // };

      const response = await llmClient().complete({
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        // Asegúrate de que tu llmClient soporte el parámetro format o adáptalo
        response_format: { type: "json_object" } 
      });

      // Ajuste según la estructura típica de respuesta
      const content = response.choices[0].message.content;
      const jsonString = extractJSON(content);
      const llmResult = JSON.parse(jsonString);

      const unificado = this.#unificarValidacion(llmResult, state.lastInteraction?.text || "", input);

      return unificado;

    } catch (error) {
      console.error("Error en clasificación:", error);
      return {
        intent: "social", // Asumimos que es social por defecto, para no bloquear la conversación
        isContinuation: false,
        confidence: 0,
      }; // Fallback seguro
    };
  };


  /**
   *  Construye un prompt detallado para que el LLM clasifique correctamente la intención del usuario,
   *  usando el contexto del estado actual del agente.
   * @param {*} input 
   * @param {*} state 
   * @returns String con el prompt completo para la clasificación de intención
   */
  #buildPrompt(input, state) {

    const lastMessage = state.lastInteraction?.text || "Ninguno";

    return`
     CONTEXTO:\n' +
        - Meta declarada: "${state.goal}"
        - Estado del sistema: ${state.status}
        - ENTRADA DEL USUARIO: "${input}"
        - ÚLTIMO MENSAJE DE RESPUESTA DEL SISTEMA: "${lastMessage}"
        - HISTORIAL DE INTERACCIONES PREVIAS: ${state.history ? state.history.map(h => `"${h.text}"`).join(" | ") : "Ninguno"}

      EClasifica en DOS dimensiones separadas:

      1. INTENT (qué quiere el usuario):
      - social (saludo, nombre, etc)
      - provide_info  el usuario aporta información útil para completar una tarea
      - request_action (pide hacer algo)
      - meta-instruction (cambia cómo debe comportarse el asistente), Ej: "responde corto", "no hables mucho", "llámame X"

      2. CONTINUATION:
      - true → si continúa el contexto actual
      - false → si inicia algo nuevo

      Devuelve JSON:
      {
        "intent": "social | provide_info | request_action | meta_instruction",
        "isContinuation": true/false,
        "confidence": 0-1
      }

      EJEMPLOS DE RESPUESTA:
      Input: "¿Qué día es hoy?"
      Output:
        {
          "intent": "request_action",
          "isContinuation": false
        }

      Input: "10 de abril"
      Output:
        {
          "intent": "provide_info",
          "isContinuation": true
        }

      Input: "a partir de ahora responde corto"
      Output:
        {
          "intent": "meta_instruction",
          "isContinuation": false
        }
    `
  };

  /**
   * Validador determinista de relación entre dos textos.
   * @param {string} t1 - Texto base (Anterior)
   * @param {string} t2 - Texto nuevo (Siguiente)
   */
  #validarRelacionDeterminista(t1, t2) {
    const clean = (txt) => txt.toLowerCase().replace(/[^\w\s]/gi, '').split(/\s+/).filter(w => w.length > 2);
    
    const words1 = clean(t1);
    const words2 = clean(t2);
    
    // 1. Intersección de Vocabulario (Índice de Jaccard)
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = words1.filter(w => set2.has(w));
    const jaccardIndex = intersection.length / (set1.size + set2.size - intersection.length || 1);

    // 2. Coincidencia de N-Gramas (Secuencias de 2 palabras)
    const getBigrams = (words) => words.map((w, i) => words[i+1] ? `${w} ${words[i+1]}` : null).filter(Boolean);
    const bigrams1 = new Set(getBigrams(words1));
    const bigrams2 = getBigrams(words2);
    const sharedBigrams = bigrams2.filter(b => bigrams1.has(b));

    // 3. Verificación de "Puente" (¿El final de T1 conecta con T2?)
    const t1End = t1.toLowerCase().trim().slice(-20);
    const t2Start = t2.toLowerCase().trim().slice(0, 20);
    
    // Lógica de decisión
    const tieneRelacionLexica = jaccardIndex > 0.15; // Comparten al menos un 15% de vocabulario único
    const tieneContinuidadEstructural = sharedBigrams.length > 0; // Comparten frases de 2 palabras
    
    return {
        relacionada: tieneRelacionLexica || tieneContinuidadEstructural,
        metricas: {
            vocabularioCompartido: (jaccardIndex * 100).toFixed(2) + "%",
            frasesComunes: sharedBigrams.length,
            palabrasClave: [...new Set(intersection)]
        },
        decision: (tieneRelacionLexica && tieneContinuidadEstructural) ? "Alta Probabilidad" : 
                  (tieneRelacionLexica || tieneContinuidadEstructural) ? "Posible" : "Inconexo"
    };
  };


  /**
 * Unifica el resultado del LLM con la validación técnica determinista.
 * @param {object} llmResult - { intent, isContinuation, confidence }
 * @param {string} textA - Texto anterior
 * @param {string} textB - Texto nuevo
 */
  #unificarValidacion(llmResult, textA, textB) {
    // 1. Ejecutamos la validación determinista (la que programamos antes)
    const det = this.#validarRelacionDeterminista(textA, textB);
    
    // Convertimos las métricas en un valor numérico de 0 a 1
    const detScore = det.relacionada ? (parseFloat(det.metricas.vocabularioCompartido) / 100) : 0;
    const hasStructure = det.metricas.frasesComunes > 0;

    // 2. Lógica de unificación (Consenso)
    let finalIsContinuation = llmResult.isContinuation;
    let finalConfidence = llmResult.confidence;

    // CASO A: El código detecta repetición o solapamiento claro (Alta fiabilidad técnica)
    if (hasStructure) {
        finalIsContinuation = true;
        finalConfidence = Math.max(finalConfidence, 0.9); // Reforzamos la confianza
    };

    // CASO B: Conflicto - El LLM dice que NO, pero el código detecta mucha relación léxica
    if (!llmResult.isContinuation && detScore > 0.25) {
        // Si comparten más del 25% de palabras, probablemente el LLM se equivocó
        finalIsContinuation = true;
        finalConfidence = 0.7; 
    };

    // CASO C: Conflicto - El LLM dice que SÍ, pero el código no ve absolutamente nada (0%)
    if (llmResult.isContinuation && detScore === 0 && !hasStructure) {
      // Aquí manda el LLM por semántica, pero bajamos la confianza por si es alucinación
      finalConfidence = Math.min(finalConfidence, 0.5);
    };

    // 3. Fallback Seguro: Si el LLM viene vacío o con error
    if (llmResult.confidence === 0) {
        return {
          intent: llmResult.intent || "social",
          isContinuation: det.relacionada, // Mandan las reglas fijas
          confidence: det.relacionada ? 0.6 : 0.3,
          source: "deterministic_fallback"
        };
    };

    return {
      intent: llmResult.intent,
      isContinuation: finalIsContinuation,
      confidence: finalConfidence,
      source: "hybrid_validation"
    };
  };

};