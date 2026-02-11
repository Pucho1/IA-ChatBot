import { rateLimit } from "@/app/helpers/retaeLimits";

import { maybeExtractFacts } from "@/app/intelligence/maybeExtractFacts";
import { buildPrompt } from "@/app/intelligence/buildPrompt";

import { llmClient } from "@/app/llm/llmClinet";

import { materializeFacts } from "@/app/memory/materializeFacts";
import { storeFact } from "@/app/memory/factStore";
import { storeSummary } from "@/app/memory/sumaryStore";
import { createMemoryStore } from "@/app/memory/memoryStore";

const memoryStore  = new Map();


export async function POST(req) {

	// Obtengo la IP del cliente desde los headers de la petición
	const ip = req.headers.get("x-forwarded-for") || "unknown";

  if( !rateLimit(ip)) {
		return new Response("Too many requests", { status: 429 });
	};

  let  message  = await req.json();

  const memory = createMemoryStore(memoryStore, ip); // Asegura que la memoria para esta IP esté inicializada
  

  // Agrego el mensaje del usuario al historial de la conversación y asi no permite bugs
  //   ya que da mas claridad sobre que recibes del front
  memory.messages.push({
    role: "user", content: message.messages
  });

  // Ambiguo --- suena a historial-- escala mal-- invita a bugs
  //  // memory.messages.push(...messages.messages);


  const extractedFacts = await maybeExtractFacts(message, memory);

  const materializedFacts = materializeFacts(extractedFacts);

  storeFact(memory, materializedFacts);

  await storeSummary(memory);

  console.log("Memory after storing facts:", memory);


  // console.log("Messages to send to OpenAI:", await messagesToSend(), "cantidd de mensajes:", (await messagesToSend()).length );
  
  const messagesToSend = buildPrompt({ memory });

  const stream = await llmClient().Stream({
    messages: messagesToSend,
    temperature: 0.7,
  });

	// creo un encoder para convertir texto a Uint8Array --"bytes"-- que bes lo que puede viajar en streams
  const encoder = new TextEncoder();

  // Es un constructor que crea un flujo de lectura de datos
	const readableStream = new ReadableStream({

    async start (controller) {
      let assistantText = ""

      try {
				// Itera sobre cada paquete de datos que llega de la fuente original
        for await (const chunk of stream) {
					// Extrae el texto específico (formato típico de OpenAI/Anthropic)
					const text = chunk.choices[0].delta?.content;

          if (text) {
            assistantText += text;
            // 'enqueue' mete el dato en la "tubería" para que el cliente lo reciba
            // 'encoder.encode' convierte el texto a bytes (Uint8Array), que es lo que viaja por los streams
            controller.enqueue(encoder.encode(text));
          }
        }

        memory.messages.push({
          role: "assistant",
          content: assistantText
        });
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
};
