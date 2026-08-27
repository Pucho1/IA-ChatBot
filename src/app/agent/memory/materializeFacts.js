/** Convierte hechos extraidos en registros completos y activos. */
export function materializeFacts( factCandidate ) {

    const HARD_KEYS = ["location", "occupation", "name", "age"];

    if ( !Array.isArray(factCandidate) || factCandidate.length === 0 ) return [];

	const inferType =  HARD_KEYS.includes(factCandidate[0].key) ? 'hard' : 'soft'; // Si la clave del hecho es una de las claves duras, lo clasificamos como "hard", de lo contrario, como "soft".

    const materializedFacts = factCandidate.map(fact => {
		return {
			id: crypto.randomUUID(),
			type: inferType,
			key: fact.key,
			value: fact.value,
			confidence: fact.confidence ?? 0.7,
			source: "fact-extraction",
			creadtedAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			status: "active",
		};
	});

    return materializedFacts;

};
