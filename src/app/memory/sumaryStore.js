import { summarizeConversation } from "@/app/intelligence/summarizeConversation";

const MAX_MESSAGES = 10;


/**
   *  Calculo si tengo mas de x mensajes en el historial
   *  Si es así, resumo los mas antiguos y los remplazo por un mensaje de resumen
   *  para mantener el contexto sin exceder el límite de mensajes.
   * @returns Arry de mensajes a enviar al modelo
   */
export async function storeSummary(memory) {

    if (memory.messages.length > MAX_MESSAGES) {

        const overflow = memory.messages.length - MAX_MESSAGES;

        const oldMessages = memory.messages.slice(0, overflow); // obtengo todos los mensajes antiguos

        const recentMessages = memory.messages.slice(-MAX_MESSAGES); // obtengo todos los mensajes recientes

        // Función para resumir la conversación
        let summarytext = await summarizeConversation([
            { ...memory.summary[0] },
            ...oldMessages,
        ]);

        memory.summary =[ {
            ...memory.summary[0],
            content: summarytext,
        }];

        memory.messages = recentMessages;
    };
};