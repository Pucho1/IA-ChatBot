import OpenAI from "openai";

// Inicializo el cliente de OpenAI creando una instancia de la clase OpenAI 
// a la cual le paso la clave de API desde las variables de entorno
// es mas compatible con el entorno de node.js pero tambien mas lenta que edge
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
     messages: [
      { role: "system", content: "Eres un asistente útil." },
      { role: "user", content: "¿Puedes saludarme en español?" },
    ],
    temperature: 0.7,
  });




  // const response = streamText({
  //   model: "gpt-4o-mini",
  //   stream: true,
  //   messages: [
  //     { role: "system", content: "Eres un asistente útil." },
  //     { role: "user", content: "¿Puedes saludarme en español?" },
  //   ],
  // })

  console.log(response);

  return Response.json({
    content: response.choices[0].message.content,
  });
}
