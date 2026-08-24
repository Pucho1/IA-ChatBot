import { AgentRuntime }   from "@/app/agent/runtime/agentRuntime";
import { AgentEngine }    from "@/app/agent/AgentEngine";
import { rateLimit }      from "@/app/helpers/retaeLimits";
import { createMemoryStore } from "@/app/agent/memory/memoryStore";
import { AgentRouter }       from "@/app/agent/routing/AgentRouter";

import { ArgumentNormalizer }     from "@/app/agent/argumentHandler/ArgumentNormalizer";
import { ArgumentResolver }       from "@/app/agent/argumentHandler/ArgumentResolver";
import { createDefaultResolvers } from "@/app/agent/argumentHandler/resolvers";
import { AgentSessionStore } from "@/app/agent/memory/AgentSessionStore";
import { IntentClassifier }  from "@/app/agent/routing/intenteClassifier/IntentClassifier";
import { agentToolProvider } from "@/app/agent/tools/agentToolProviderInstance";


const memoryStore  = new Map(); // memoria para el contexto del agente
const sessionStore = new AgentSessionStore();

export async function POST(req) {

	// Obtengo la IP del cliente desde los headers de la petición
	const ip = req.headers.get("x-forwarded-for") || "unknown";

  if( !rateLimit(ip)) {
		return new Response("Too many requests", { status: 429 });
	};

  let { messages }          = await req.json();
  const memory              = createMemoryStore(memoryStore, ip);
  const argumentNormalizer  = new ArgumentNormalizer();
  const intentClassifier    = new IntentClassifier();
  const router              = new AgentRouter();
  let state                 = sessionStore.get(ip);


  if (!state) {
    state = {
      goal: null,              // El objetivo que el agente debe cumplir, se actualiza dinámicamente
      currentInput: messages,
      planGraph : null,        // El plan que el agente genera para cumplir su objetivo.
      status    : "idle",      // "idle" | "planning" | "executing" | "observing" | "evaluating" | "replanning" | "completed"
      step      : 0,           // Paso actual del agente, se incrementa en cada iteración del loop
      maxSteps  : 10,          // Pasos máximos permitidos
      history   : [],          // Historial de decisiones y observaciones para mantener el contexto y Fuente única de verdad
      error     : null,        // Información de error en caso de fallo
      startedAt : Date.now(),  // Timestamp de inicio para calcular duración total
      finishedAt: null,        // Timestamp de finalización
      metrics   : {
          totalErrors: 0,
          toolCalls: 0
      },
      retryCount: 0,
      maxRetries: 1,
      lastInteraction: {},
      detectedIntent: null,
      context: {
        reference: null, // Información de referencia que el agente puede usar para tomar decisiones, se actualiza dinámicamente.
      },
    } 
  } else {
    state.currentInput = messages;
  };

  const registry = await agentToolProvider.getRegistry();


  const argumentResolver = new ArgumentResolver({
    resolvers: createDefaultResolvers(),
  });

  const agent = new AgentEngine({ memory });

  const runtime = new AgentRuntime({
    engine : agent,
    registry,
    router,
    argumentNormalizer,
    argumentResolver,
    intentClassifier,
    memory,
  });

  memory.handlerUserInput(messages);

  const agentResponse = await runtime.run(state);

  sessionStore.set(ip, state);

  console.log("respuest del AgentRuntime ------->", agentResponse);

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
