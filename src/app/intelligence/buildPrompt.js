/**
 * Construye la lista de mensajes que se enviara al modelo de lenguaje.
 *
 * El contexto se compone en un orden estable: instrucciones del sistema,
 * hechos conocidos del usuario, resumen de la conversacion y mensajes recientes.
 * Los hechos se incluyen como contexto adicional solo cuando existen, mientras
 * que el resumen y los mensajes se incorporan directamente desde la memoria.
 *
 * @param {{memory: {facts: Array, summary?: Array, messages: Array}}} params
 *   Memoria conversacional que aporta los datos del prompt.
 * @returns {Array<{role: string, content: string}>} Mensajes listos para el LLM.
 */

export function buildPrompt({ memory }) {

      // Definimos el comportamiento aquí
      const systemMessage = {
        role: "system",
        content: "eres un chatbot útil y amigable.",
      };

    const messagesToSend  = [
        // El modelo recibe primero las instrucciones y despues el contexto
        // persistido y la conversacion reciente.
        systemMessage,
        ...(memory.facts.length
        ? [
            {
              role: "system",
              content: "Hechos conocidos sobre el usuario (úsalos solo si son relevantes para responder, " +
              "no los repitas explícitamente a menos que el usuario lo pida):\n" +
              memory.facts.map(fact => `- ${fact}`).join("\n"),
            }
            ]
        : []
        ),
        ...(memory.summary ? memory.summary : []),
        ...memory.messages
    ];

  return messagesToSend;
};