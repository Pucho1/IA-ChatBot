import OpenAI from "openai";

import { rateLimit } from "@/app/helpers/retaeLimits";

// Inicializo el cliente de OpenAI creando una instancia de la clase OpenAI 
// a la cual le paso la clave de API desde las variables de entorno
// es mas compatible con el entorno de node.js pero tambien mas lenta que edge
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_MESSAGES = 10;

export async function POST(req) {

	// Obtengo la IP del cliente desde los headers de la petición
	const ip        = req.headers.get("x-forwarded-for") || "unknown";

  let summary     = [];
  let  messages  = await req.json();
  // Definimos el comportamiento aquí
  const systemMessage = {
    role: "system",
    content: "eres un chatbot útil y amigable.",
  };

	if( !rateLimit(ip)) {
		return new Response("Too many requests", { status: 429 });
	};

  /**
   *  Csalculo si tengo mas de x mensajes en el historial
   *  Si es así, resumo los mas antiguos y los reemplazo por un mensaje de resumen
   *  para mantener el contexto sin exceder el límite de mensajes.
   * @returns Arry de mensajes a enviar al modelo
   */
  const messagesToSend = async () => {
    // solo si hay mas de MAX_MESSAGES en el historial
    if (messages.messages.length > MAX_MESSAGES) {
      const oldMessages = messages.messages.slice(0, messages.messages.length - MAX_MESSAGES); // obtengo todos los mensajes antiguos

      const recentMessages = messages.messages.slice(-MAX_MESSAGES); // obtengo todos los mensajes recientes

      // Función para resumir la conversación
      let summarytext = await summarizeConversation(oldMessages);

      summary = {
        role: "system",
        content: `Resumen previo de la conversación: ${summarytext}`,
      };

      messages.messages = recentMessages;
    };

    
    // retorno el array de mensajes a enviar al modelo
    //  system + resumen (si lo hay) + mensajes recientes
    return [systemMessage, ...(summary ? summary : []), ...messages.messages];
  };
  
  const stream = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [...messagesToSend()],
    temperature: 0.7,
    stream: true,
    
  });

	// creo un encoder para convertir texto a Uint8Array --"bytes"-- que bes lo que puede viajar en streams
  const encoder = new TextEncoder();

  // Es un constructor que crea un flujo de lectura de datos
	const readableStream = new ReadableStream({
    async start (controller) {
      try {
				// Itera sobre cada paquete de datos que llega de la fuente original
        for await (const chunk of stream) {
					// Extrae el texto específico (formato típico de OpenAI/Anthropic)
					const text = chunk.choices[0].delta?.content;

					// 'enqueue' mete el dato en la "tubería" para que el cliente lo reciba
					// 'encoder.encode' convierte el texto a bytes (Uint8Array), que es lo que viaja por los streams
					controller.enqueue(encoder.encode(text));
        }
      } catch (error) {
        controller.error(error);
      } finally {
				// Pase lo que pase, al terminar el bucle, cierra la "llave" del stream
        controller.close();
      }
    }
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
