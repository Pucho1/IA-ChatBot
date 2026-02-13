/**
 * 
 * @param {*} param0 
 * @returns 
 */

export function buildPrompt({ memory }) {

      // Definimos el comportamiento aquí
      const systemMessage = {
        role: "system",
        content: "eres un chatbot útil y amigable.",
      };

    const messagesToSend  = [
        // retorno el array de mensajes a enviar al modelo
        //  system + facts +  resumen (si lo hay) + mensajes recientes
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