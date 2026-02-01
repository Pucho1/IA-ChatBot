import OpenAI from "openai";

const client = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

export async function maybeExtractFacts(message, memory) {

	const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
			{
				role: "system",
				content:  
					"Extrae SOLO hechos estables sobre el usuario.\n" +
					"Si no hay ninguno, responde exactamente: NONE.\n" +
					"Devuelve CADA hecho en una línea separada usando salto de línea.\n" +
					"No escribas nada más."
				},
				{
					role: "user",
					content: message.messages,
				},
		],
  });

	const text = response.choices[0].message.content.trim();

	if ( text === "NONE" ) return;

	// Si hay hechos, asume que vienen uno por línea. Corta el texto por saltos de línea y limpia cada frase.
	const  facts = text.split(/\n|\. /).map(fact => fact.trim()).filter(Boolean);

	for ( const fact of facts ) {
		if ( fact && !memory.facts.includes(fact) ) {
			memory.facts.push(fact);
		};
	};

};
