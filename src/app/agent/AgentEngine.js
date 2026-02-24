
import { resolveAction } from "../actions/actionResolve";
import { llmClient } from "../llm/llmClinet";
import { extractJSON } from "../sanyty/verifyJsonResponse";


export class AgentEngine {
    constructor({ memory, registry }) {
        this.memory = memory;
        this.registry = registry;
    };

    async run(userInput) {
        this.memory.handlerUserInput(userInput);// guardo el input del usuario en la memoria

        const toolManifest = this.registry.getToolManifest();

        while(true) {

            const llmResponse = await llmClient().complete(
                {
                    messages: this.memory.buildPrompt({ tools: toolManifest }), // construyo el prompt con la memoria y se lo paso al LLM, espero su respuesta
                    temperature: 0.7,
                    format: "json_object"
                }
            );

            console.log("esta es la respuesta de llm dentro de AgentEngine------>", llmResponse.choices[0].message)

            const cleanedResponse = extractJSON(llmResponse.choices[0].message.content);

            if (!cleanedResponse) {
              console.error("No se encontró JSON válido");
              return new Response("Model format error", { status: 500 });
            };

            try{
              clearLlmOutput = JSON.parse(cleanedResponse); // esto puede traer un error de formato devido a la respuesta dda por la IA
            } catch(error){ 
              // deberia tratar este error 
              console.error("La IA envió basura, intentando limpiar...");
              return new Response("Invalid JSON from LLM", { status: 500 });
            };

            // Aqui puedo parsear datos antes de resolver la acción, por ejemplo si quiero extraer un json de una respuesta que no esta bien formateada
            const action = resolveAction(clearLlmOutput);

            if(action.type === "tool") {

                this.memory.addToolCall(action.tool, action.args);

                const result = await this.registry.execute(action.tool, action.args);

                this.memory.addToolResult(action.tool, result);

            };

            if(action.type === "final") {

                this.memory.addAssistantResponse(action.content);

                return action.content;
            };

        };
    };
  
};
