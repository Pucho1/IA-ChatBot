import { llmClient } from "../llm/llmClinet";


export async function maybeExtractFacts(message, memory) {

	const promptMessage= [
		{
			role: "system",
			content:
				`Extrae hechos estables del usuario (name, age, location, occupation, hobbies, preferences, personality traits, relationship status, education, skills).
				Debes responder con un objeto JSON que contenga una lista llamada "facts".
				Cada hecho debe tener: "key", "value", "confidence" (0-1).
				Ejemplo: { "facts": [{ "key": "name", "value": "migue", "confidence": 1 }] }
				Si no hay hechos, devuelve { "facts": [] }.`
		},
		{
			role: "user",
			content: message.messages,
		},
	];
	
 	const response = await llmClient().complete({ messages: promptMessage, temperature: 0, format: "json_object" });

	const responseFactCandidate = response.choices[0].message.content;
	const factCandidate = JSON.parse(responseFactCandidate); // <-- Aquí se parsea la respuesta JSON del modelo para obtener 
	// los hechos candidatos ya que el modelo devuelve un formato json pero en string


	console.log("Fact candidate:", factCandidate, );

	return [...factCandidate.facts]; // Devuelvo solo la lista de hechos extraídos del objeto JSON parseado

};
