import OpenAI from "openai";


// Inicializo el cliente de OpenAI creando una instancia de la clase OpenAI
// a la cual le paso la clave de API desde las variables de entorno
// es mas compatible con el entorno de node.js pero tambien mas lenta que edge
const client = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

export function llmClient() {
    async function complete ({ messages, temperature, format, tools }){

        const config = {
            model: "gpt-4o-mini",
            temperature,
            messages,
        };

        if (format === "json_object") {
            config.response_format = { type: "json_object" };
            config.max_tokens = 500; // Limito la respuesta a 500 tokens para evitar respuestas demasiado largas
        }

        if (tools) {
            config.tools = tools;
            config.tool_choice = "auto"; // Dejo que el modelo decida automáticamente qué herramienta usar, si es que necesita usar alguna. Esto es crucial para que el modelo pueda decidir no usar herramientas si no las necesita, lo que puede resultar en respuestas más directas y rápidas cuando las herramientas no son necesarias.
        };

        console.log("esto es lo que envio ---------->", config)

        return await client.chat.completions.create(config);
    };


    async function Stream ({ messages, temperature }){

        console.log("Building prompt with messages: ---------?????", messages);

        return await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages,
            // reasoning_effort: "medium",
            temperature: temperature,
            stream: true,
        });
    };

  return {complete, Stream};

};
