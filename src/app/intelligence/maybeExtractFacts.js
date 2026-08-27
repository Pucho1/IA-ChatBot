import { llmClient } from "../llm/llmClinet";

/**
 * Extrae del mensaje los hechos estables que puedan asociarse al usuario.
 *
 * Solicita al LLM una respuesta JSON con una propiedad `facts`, analiza esa
 * respuesta y devuelve unicamente la lista de hechos encontrados. Cada hecho
 * debe incluir una clave, un valor y un nivel de confianza entre 0 y 1.
 *
 * @param {string} message Mensaje del usuario que se analizara.
 * @returns {Promise<Array>} Hechos candidatos extraidos del mensaje.
 * @throws {Error} Si el LLM falla o su respuesta no contiene JSON valido.
 */
export async function maybeExtractFacts(message) {

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
			content: message,
		},
	];
	
 	const response = await llmClient().complete({ messages: promptMessage, temperature: 0, format: "json_object" });

	const responseFactCandidate = response.choices[0].message.content;
	const factCandidate = JSON.parse(responseFactCandidate);
	// La respuesta del modelo llega como texto; aqui se convierte en datos utilizables.


	return [...factCandidate.facts]; // Se expone solo la lista, no el envoltorio JSON.

};
