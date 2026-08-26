import OpenAI from "openai";
// import { debug } from "@/app/agent/debug/debug";


// Inicializo el cliente de OpenAI creando una instancia de la clase OpenAI
// a la cual le paso la clave de API desde las variables de entorno
// es mas compatible con el entorno de node.js pero tambien mas lenta que edge
const client = new OpenAI({
	apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
});

export function llmClient() {
    async function complete ({ messages, temperature, format, tools, toolChoice }){

        const config = {
            model: "deepseek-v4-flash",
            temperature,
            messages,
        };

        if (format === "json_object") {
            config.response_format = { type: "json_object" };
            config.max_tokens = 500; // Limito la respuesta a 500 tokens para evitar respuestas demasiado largas
        }

        if (tools) {
            config.tools = tools;
            config.tool_choice = toolChoice ?? "auto";
            config.temperature = 0; // Si hay herramientas, bajo la temperatura para que las respuestas sean más determinísticas, lo cual es importante para que el modelo tome decisiones más consistentes sobre cuándo usar herramientas y cuáles usar.
            config.thinking = {
                type: "disabled"
            }
        };

        console.log("esto es lo que envio ---------->", config)
        // debug.log("[llmClient] completion config", config);

        return await client.chat.completions.create(config);
    };


    async function Stream ({ messages, temperature }){
        // debug.log("[llmClient] stream messages", messages);

        console.log("Building prompt with messages: ---------?????", messages);

        return await client.chat.completions.create({
            model: "deepseek-v4-flash",
            messages,
            // reasoning_effort: "medium",
            temperature: temperature,
            stream: true,
        });
    };

  return {complete, Stream};

};
