/**
 * 
 * @param {*} param0 
 * @returns 
 */

export function buildPrompt({ systemMessage, memory }) {

    const messagesToSend  = [
        // retorno el array de mensajes a enviar al modelo
        //  system + resumen (si lo hay) + mensajes recientes
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