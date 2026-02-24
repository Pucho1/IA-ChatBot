import { llmClient } from "../llm/llmClinet";

const systemMessage = {
	role: "system",
	content: "crea un resumen claro y conciso de la conversación previa que sirva para matener el contexto de lo que se habla  y en la menor cantidad de palabras posible.",
};

export async function summarizeConversation(messages) {

  const response = await llmClient().complete({
    messages: [systemMessage, ...messages],
    temperature: 0.7,
    format: "text",
  });

  // console.log("Resumen generado:", response.choices[0].message.content, "ata qe le entro ----> ", messages );

  return response.choices[0].message.content ;
};
