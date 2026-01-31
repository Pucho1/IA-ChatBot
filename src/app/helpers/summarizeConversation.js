import OpenAI from "openai";

const client = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

const systemMessage = {
	role: "system",
	content: "crea un resumen claro y conciso de la conversación previa que sirva para matener el contexto de lo que se habla  y en la menor cantidad de palabras posible.",
};

export async function summarizeConversation(messages) {
  
	const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [systemMessage, ...messages],
    temperature: 0.7,
  });

  return response.choices[0].message.content ;
};
