import { llmClient } from "@/app/llm/llmClinet";
import { extractJSON } from "@/app/sanyty/verifyJsonResponse";


// estados del intent classifier
// - social: saludos, despedidas, preguntas sobre el asistente, etc. No aportan información relevante para cumplir la tarea pero son importantes para la interacción social.
// - provide_info: el usuario aporta información útil para completar una tarea, como datos, hechos, preferencias, etc.
// - request_action: el usuario pide hacer algo específico, como ejecutar una acción, buscar información, etc. Indica una intención clara de que el asistente realice una tarea concreta.
// - meta_instruction: el usuario da instrucciones sobre cómo debe comportarse el asistente, como cambiar su estilo de respuesta, pedir que sea más breve, etc. No afectan l atarea.

export class IntentClassifier {

  /**
   * Clasifica la intención del usuario y si su entrada es una continuación del contexto actual utilizando un enfoque 
   * híbrido que combina la clasificación inicial de un LLM con análisis deterministas basados en el contenido textual. 
   * El método construye un prompt detallado para el LLM, obtiene su clasificación inicial y luego aplica reglas adicionales 
   * para ajustar la clasificación de continuación y la confianza según señales explícitas, la relación textual entre la entrada
   * actual y la última interacción, y el estado del sistema, proporcionando una evaluación más robusta y matizada de la intención del usuario.
   * @param {*} input 
   * @param {*} state 
   * @returns 
   */
  async getIntent(input, state) {
    const prompt = this.#buildPrompt(input, state);

    try {
      const response = await llmClient().complete({
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      const jsonString = extractJSON(content);
      const llmResult = JSON.parse(jsonString);

      return this.#unificarValidacion(
        llmResult,
        state.lastInteraction?.text || "",
        input,
        state
      );
    } catch (error) {
      console.error("Error en clasificacion:", error);
      
      return {
        intent: "social",
        isContinuation: false,
        confidence: 0,
      };
    }
  };

  /**
   * Construye un prompt detallado para el LLM que incluye el contexto relevante del sistema, 
   * la entrada del usuario, el último mensaje del sistema y el historial de interacciones. 
   * El prompt guía al LLM para clasificar la intención del usuario en categorías específicas y determinar si la entrada es una continuación del contexto actual, 
   * proporcionando ejemplos claros para mejorar la precisión de la clasificación.
   * @param {*} input 
   * @param {*} state 
   * @returns 
   */
  #buildPrompt(input, state) {
    const lastMessage = state.lastInteraction?.text || "Ninguno";

    return `
      CONTEXTO:
      - Meta declarada: "${state.goal}"
      - Estado del sistema: ${state.status}
      - ENTRADA DEL USUARIO: "${input}"
      - ULTIMO MENSAJE DE RESPUESTA DEL SISTEMA: "${lastMessage}"
      - HISTORIAL DE INTERACCIONES PREVIAS: ${state.history ? state.history.map((h) => `"${h.text}"`).join(" | ") : "Ninguno"}

      Clasifica en DOS dimensiones separadas:

      1. INTENT (que quiere el usuario):
      - social (saludo, nombre, etc)
      - provide_info (el usuario aporta informacion util para completar una tarea)
      - request_action (pide hacer algo)
      - meta_instruction (cambia como debe comportarse el asistente)

      2. CONTINUATION:
      - true si continua el contexto actual
      - false si inicia algo nuevo
      - SOLO marca true si el sistema estaba esperando esa informacion, si hay referencias explicitas al contexto previo o si existe una relacion clara con el ultimo intercambio
      - Un dato corto o fragmento suelto como "10 de abril", "Madrid" o "2" no es continuacion por si solo; solo lo es si responde a una pregunta pendiente del sistema

      Devuelve JSON:
      {
        "intent": "social | provide_info | request_action | meta_instruction",
        "isContinuation": true,
        "confidence": 0.0
      }

      EJEMPLOS:
      Input: "Que dia es hoy?"
      Output:
      {
        "intent": "request_action",
        "isContinuation": false,
        "confidence": 0.95
      }

      Input: "10 de abril"
      Output:
      {
        "intent": "provide_info",
        "isContinuation": true,
        "confidence": 0.95
      }

      Input: "a partir de ahora responde corto"
      Output:
      {
        "intent": "meta_instruction",
        "isContinuation": false,
        "confidence": 0.95
      }
    `;
  };

  /**
   *  Detecta señales explícitas de continuación, como pronombres demostrativos, referencias temporales o conectores lógicos que indican que el usuario está añadiendo información relacionada con el contexto actual.
   * @param {*} input 
   * @returns 
   */
  #hasExplicitContinuationCue(input) {
    const lower = input.toLowerCase();

    return [
      "eso",
      "esta",
      "este",
      "ese",
      "esa",
      "lo anterior",
      "lo de antes",
      "continua",
      "contin�a",
      "sigue",
      "ahora",
      "tambien",
      "tambi�n",
      "primero",
      "segundo",
      "tercero",
      "ultimo",
      "�ltimo",
    ].some((token) => lower.includes(token));
  };

  /**
   *  Detecta si la entrada del usuario parece ser una solicitud independiente que no está relacionada con el contexto actual, lo que sugiere que el usuario está iniciando un nuevo tema o tarea en lugar de continuar con el anterior.
   * @param {*} input 
   * @returns 
   */
  #looksLikeStandaloneRequest(input) {
    const trimmed = input.trim();
    const lower = trimmed.toLowerCase();

    if (!trimmed) return false;
    if (trimmed.includes("?")) return true;

    return [
      "quiero",
      "necesito",
      "busca",
      "dime",
      "haz",
      "crea",
      "genera",
      "explica",
      "resume",
      "compara",
      "muestrame",
      "mu�strame",
      "dame",
      "cual",
      "cu�l",
      "que ",
      "qu� ",
      "como ",
      "c�mo ",
    ].some((token) => lower.startsWith(token));
  };

  /**
   * Evalúa el estado del sistema para identificar si hay pasos bloqueados, 
   * selecciones pendientes o preguntas abiertas que sugieran que el usuario debería estar proporcionando información 
   * relacionada con el contexto actual, lo que puede indicar que su entrada es una continuación de lo que el sistema está 
   * esperando para avanzar en la tarea.
   * @param {*} state 
   * @returns 
   */
  #hasPendingUserInputRequest(state = {}) {
    const hasBlockedSteps = state.planGraph?.steps?.some(
      (step) => step.status === "blocked"
    );
    const awaitingSelection = Boolean(state.context?.awaitingSelection);
    const lastMessage = (state.lastInteraction?.text || "").trim().toLowerCase();
    const systemAskedQuestion =
      lastMessage.endsWith("?") ||
      ["elige", "selecciona", "indica", "necesito", "faltan", "confirma"].some(
        (token) => lastMessage.includes(token)
      );

    return Boolean(
      state.goal &&
      (hasBlockedSteps || awaitingSelection || systemAskedQuestion)
    );
  };

  /**
   *  Evalúa si la entrada del usuario parece ser un dato suelto, una fecha,
   *  un número o un fragmento corto que no contiene señales explícitas de continuación ni una relación clara con el contexto actual,
   *  lo que sugiere que el usuario podría estar proporcionando información puntual o iniciando un nuevo tema en lugar
   *  de continuar con el anterior. Esto ayuda a evitar clasificar erróneamente como continuación entradas que son independientes
   *  o que responden a preguntas específicas sin necesidad de mantener continuidad con el contexto previo.
   * @param {*} input 
   * @returns 
   */
  #looksLikeBareDataPoint(input) {
    const trimmed = input.trim();

    if (!trimmed) return false;
    if (trimmed.includes("?")) return false;
    if (this.#looksLikeStandaloneRequest(trimmed)) return false;

    const lower = trimmed.toLowerCase();
    const words = lower.split(/\s+/).filter(Boolean);
    const hasVerbLikeRequest = [
      "quiero",
      "necesito",
      "busca",
      "dime",
      "haz",
      "crea",
      "genera",
      "explica",
      "resume",
      "compara",
      "dame",
    ].some((token) => lower.startsWith(token));

    if (hasVerbLikeRequest) return false;

    const looksLikeDate =
      /^\d{1,2}\s+de\s+[a-záéíóúüñ]+$/i.test(trimmed) ||
      /^\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?$/.test(trimmed);
    const looksLikeScalar = /^\d+([.,]\d+)?$/.test(trimmed);
    const looksLikeShortFragment = words.length <= 4;

    return looksLikeDate || looksLikeScalar || looksLikeShortFragment;
  };

  /**
   *  Evalúa la relación entre dos textos para determinar si están relacionados temáticamente o estructuralmente, lo que puede indicar que el segundo texto es una continuación del primero. Utiliza métricas como el índice de Jaccard para medir la superposición de vocabulario y la detección de bigramas compartidos para identificar continuidad estructural.
   *  Esto ayuda a validar o cuestionar la clasificación inicial del LLM sobre si una entrada es una continuación o no, proporcionando una capa adicional de análisis basada en el contenido textual.
   * @param {*} t1 
   * @param {*} t2 
   * @returns 
   */
  #validarRelacionDeterminista(t1, t2) {
    const clean = (txt) =>
      txt
        .toLowerCase()
        .replace(/[^\w\s]/gi, "")
        .split(/\s+/)
        .filter((w) => w.length > 2);

    const words1 = clean(t1);
    const words2 = clean(t2);

    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = words1.filter((w) => set2.has(w));
    const jaccardIndex =
      intersection.length / (set1.size + set2.size - intersection.length || 1);

    const getBigrams = (words) =>
      words
        .map((w, i) => (words[i + 1] ? `${w} ${words[i + 1]}` : null))
        .filter(Boolean);

    const bigrams1 = new Set(getBigrams(words1));
    const bigrams2 = getBigrams(words2);
    const sharedBigrams = bigrams2.filter((b) => bigrams1.has(b));

    const tieneRelacionLexica = jaccardIndex > 0.15;
    const tieneContinuidadEstructural = sharedBigrams.length > 0;

    return {
      relacionada: tieneRelacionLexica || tieneContinuidadEstructural,
      metricas: {
        vocabularioCompartido: `${(jaccardIndex * 100).toFixed(2)}%`,
        frasesComunes: sharedBigrams.length,
        palabrasClave: [...new Set(intersection)]
      },
      decision:
        tieneRelacionLexica && tieneContinuidadEstructural
          ? "Alta Probabilidad"
          : tieneRelacionLexica || tieneContinuidadEstructural
            ? "Posible"
            : "Inconexo"
    };
  };

  /**
   *  Integra la clasificación inicial del LLM con análisis deterministas basados en el contenido textual para llegar a una decisión más informada sobre la intención del usuario y si su entrada es una continuación del contexto actual. Ajusta la confianza y la clasificación de continuación según señales explícitas, la relación textual entre la entrada actual y la última interacción, y el estado del sistema, proporcionando una evaluación más robusta y matizada que puede mejorar la precisión de la clasificación de intenciones en escenarios complejos.
   * @param {*} llmResult 
   * @param {*} textA 
   * @param {*} textB 
   * @param {*} state 
   * @returns 
   */
  #unificarValidacion(llmResult, textA, textB, state = {}) {
    if (!state.goal) {
      return {
        intent: llmResult.intent || "social",
        isContinuation: false,
        confidence: llmResult.confidence ?? 1,
        source: "no_goal_fallback"
      };
    }

    const det = this.#validarRelacionDeterminista(textA, textB);

    const detScore = det.relacionada
      ? parseFloat(det.metricas.vocabularioCompartido) / 100
      : 0;

    const hasStructure            = det.metricas.frasesComunes > 0;
    const explicitContinuationCue = this.#hasExplicitContinuationCue(textB);
    const standaloneRequest       = this.#looksLikeStandaloneRequest(textB);
    const pendingUserInputRequest = this.#hasPendingUserInputRequest(state);
    const bareDataPoint           = this.#looksLikeBareDataPoint(textB);

    let finalIsContinuation = llmResult.isContinuation;
    let finalConfidence     = llmResult.confidence;

    if (hasStructure) {
      finalIsContinuation = true;
      finalConfidence     = Math.max(finalConfidence ?? 0, 0.9);
    }

    if (!llmResult.isContinuation && detScore > 0.25) {
      finalIsContinuation = true;
      finalConfidence     = 0.7;
    }

    if (llmResult.isContinuation && detScore === 0 && !hasStructure) {
      finalConfidence = Math.min(finalConfidence ?? 0.5, 0.5);
    }

    if (pendingUserInputRequest) {
      finalIsContinuation =
        explicitContinuationCue ||
        hasStructure ||
        detScore > 0.18 ||
        (llmResult.intent === "provide_info" && !standaloneRequest);
      finalConfidence = finalIsContinuation
        ? Math.max(finalConfidence ?? 0, 0.8)
        : Math.min(finalConfidence ?? 0.5, 0.4);
    }

    if (
      !pendingUserInputRequest &&
      llmResult.intent === "provide_info" &&
      bareDataPoint &&
      !explicitContinuationCue &&
      !det.relacionada
    ) {
      finalIsContinuation = false;
      finalConfidence = Math.max(finalConfidence ?? 0, 0.8);
    }

    if (llmResult.intent === "meta_instruction") {
      finalIsContinuation = false;
      finalConfidence = Math.max(finalConfidence ?? 0, 0.9);
    }

    if (
      llmResult.intent === "request_action" &&
      standaloneRequest &&
      !explicitContinuationCue
    ) {
      finalIsContinuation = false;
      finalConfidence = Math.max(finalConfidence ?? 0, 0.85);
    }

    if (llmResult.intent === "social") {
      finalIsContinuation = false;
      finalConfidence = Math.max(finalConfidence ?? 0, 0.9);
    }

    if (llmResult.confidence === 0) {
      return {
        intent: llmResult.intent || "social",
        isContinuation: det.relacionada,
        confidence: det.relacionada ? 0.6 : 0.3,
        source: "deterministic_fallback"
      };
    }

    return {
      intent: llmResult.intent,
      isContinuation: finalIsContinuation,
      confidence: finalConfidence,
      source: "hybrid_validation"
    };
  };
}
