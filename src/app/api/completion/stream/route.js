import { AgentRuntime } from "@/app/agent/runtime/agentRuntime";
import { AgentEngine } from "@/app/agent/AgentEngine";
import { ToolRegistry } from "@/app/agent/tools/ToolRegistry";
import { rateLimit } from "@/app/helpers/retaeLimits";
import { createMemoryStore } from "@/app/agent/memory/memoryStore";
import { AgentRouter } from "@/app/agent/routing/AgentRouter";

import { cognitiveTools } from "@/app/agent/tools/cognitiveTools ";
import { executionTools } from "@/app/agent/tools/executionTools";
import { ArgumentNormalizer } from "@/app/agent/argumentHandler/ArgumentNormalizer";



const memoryStore = new Map();

export async function POST(req) {

	// Obtengo la IP del cliente desde los headers de la petición
	const ip = req.headers.get("x-forwarded-for") || "unknown";

  if( !rateLimit(ip)) {
		return new Response("Too many requests", { status: 429 });
	};

  let { messages }          = await req.json();
  const memory              = createMemoryStore(memoryStore, ip); // Asegura que la memoria para esta IP esté inicializada
  const registry            = new ToolRegistry(); // Una sola fuente de verdad
  const argumentNormalizer  = new ArgumentNormalizer();
  const router              = new AgentRouter();

  executionTools.forEach(tool => registry.registerExecution(tool));
  cognitiveTools.forEach(tool => registry.registerCognitive(tool));

  const agent = new AgentEngine({
    memory: memory,
    registry, // Puedes pasar el registry si está disponible
  });


  const runtime = new AgentRuntime({
    engine : agent,
    registry,
    maxSteps: 6,
    router,
    argumentNormalizer,
  });

  const agentResponse = await runtime.handlerUserInput(messages);



  console.log("respuest del AgentRuntime ------->", agentResponse)

	// creo un encoder para convertir texto a Uint8Array --"bytes"-- que bes lo que puede viajar en streams
  // const encoder = new TextEncoder();

  // Es un constructor que crea un flujo de lectura de datos
	// const readableStream = new ReadableStream({

  //   async start (controller) {
  //     let assistantText = ""

  //     try {
  //       // Itera sobre cada paquete de datos que llega de la fuente original
  //       for await (const chunk of stream) {
  //         // Extrae el texto específico (formato típico de OpenAI/Anthropic)
  //         const text = chunk.choices[0].delta?.content;

  //         if (text) {
  //           assistantText += text;
  //           // 'enqueue' mete el dato en la "tubería" para que el cliente lo reciba
  //           // 'encoder.encode' convierte el texto a bytes (Uint8Array), que es lo que viaja por los streams
  //           controller.enqueue(encoder.encode(text));
  //         }
  //       }

  //       memory.addAssistantResponse(assistantText);

  //     } catch (error) {
  //       controller.error(error);
  //     } finally {
  //       // Pase lo que pase, al terminar el bucle, cierra la "llave" del stream
  //       controller.close();
  //     }
  //   }
  // });

  return new Response(agentResponse.output || agentResponse.error, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};
