import OpenAI from "openai";


// Inicializo el cliente de OpenAI creando una instancia de la clase OpenAI
// a la cual le paso la clave de API desde las variables de entorno
// es mas compatible con el entorno de node.js pero tambien mas lenta que edge
const client = new OpenAI({
	apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
});

/**
 * Crea las operaciones de comunicacion con el modelo DeepSeek mediante la
 * interfaz compatible de OpenAI. Devuelve una operacion para respuestas
 * completas y otra para respuestas en streaming.
 *
 * @returns {{complete: Function, Stream: Function}} Cliente con las operaciones
 *   disponibles para completar conversaciones.
 */
export function llmClient() {
    /**
     * Solicita una respuesta completa al modelo.
     *
     * Si se proporcionan herramientas, configura la llamada para tool calling
     * y usa temperatura cero. Con `format: "json_object"` solicita una respuesta
     * JSON y limita su longitud a 500 tokens.
     *
     * @param {{messages: Array, temperature: number, format?: string,
     *   tools?: Array, toolChoice?: object|string}} params Configuracion de la llamada.
     * @returns {Promise<object>} Respuesta de `chat.completions.create`.
     */
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

        return await client.chat.completions.create(config);
    };


    /**
     * Inicia una respuesta en streaming para recibir el contenido por partes.
     *
     * @param {{messages: Array, temperature: number}} params Mensajes y temperatura.
     * @returns {Promise<object>} Stream devuelto por la API de chat.
     */
    async function Stream ({ messages, temperature }){

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
