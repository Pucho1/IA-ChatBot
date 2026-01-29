
const client = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

const systemMessage = {
	role: "system",
	content: "crea un resumen claro y conciso de la conversación previa que sirva para matener el contexto de lo que se habla  y en la menor cantidad de palabras posible.",
};

const summarizeConversation = async (messages) => {
  
	  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [systemMessage, ...messages.messages],
    temperature: 0.7,
  });

  console.log("Summary response:", response);

  return response.choices[0].message.content ;
};

export default summarizeConversation;