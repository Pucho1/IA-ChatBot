const RATE_LIMIT = 10; // requests
const WINDOW_MS = 60_000; // 1 minuto

// Mapa para guardar los datos de las solicitudes por IP
// clave: IP, valor: array de timestamps de solicitudes
const ipRequests = new Map();


/**
 * Guarda timestamps por IP limpias los viejos si hay más de 10 en 1 minuto → bloqueo
 *  timestamps -----> (tiempo en el que se envio el mensaje)
 * @param {*} ip
 * @returns boolean
 */
export function rateLimit(ip){

  const currentTime = Date.now();

	// Si no hay datos para esta IP, inicializo un array vacío con el IP como clave
  if(!ipRequests.has(ip)){
		ipRequests.set(ip, []);
	}

	// Obtengo el array de timestamps para esta IP
	const timestamps = ipRequests.get(ip);

	ipRequests.forEach( (value, key) => console.log(`IP: ${key} ---  times: ${value[0]} --- Requests: ${value.length}`) );
	
	// filtro los timestamps para quedarme solo con los que están dentro de la ventana de tiempo (1 minuto)
	const recent = timestamps.filter(oldtimes => currentTime - oldtimes < WINDOW_MS);

	// Agrego el timestamp actual al array de recientes porque este es el ultimo 
	// y tambien  lo tengo que etener en cuata para saber si son mas de 10 en 1 minuto
	recent.push(currentTime);

	// Actualizo el mapa con los timestamps recientes asi limpio los viejos y aseguro que no se acumulen en memoria
	ipRequests.set(ip, recent);

	// Si hay más de RATE_LIMIT timestamps recientes, bloqueo la solicitud
	return recent.length < RATE_LIMIT;
};

    /**
     *  Limpia y valida la respuesta del LLM, asegurándose de que sea un JSON válido y manejando errores de formato. Esto es crucial para evitar que el agente falle debido a respuestas mal formateadas del LLM, lo cual es común cuando el LLM no sigue estrictamente las instrucciones o cuando hay ruido en la generación.
     * @param {*} rawResponse 
     * @returns 
     */
function clearResponse(rawResponse) {  
	const cleanedResponse = extractJSON(rawResponse);

	if (!cleanedResponse) {
		console.error("No se encontró JSON válido");
		return new Response("Model format error", { status: 500 });
	};

	// try{
	//     clearLlmOutput = JSON.parse(cleanedResponse); // esto puede traer un error de formato devido a la respuesta dda por la IA
	// } catch(error){
	//     // deberia tratar este error 
	//     console.error("La IA envió basura, intentando limpiar...");
	//     return new Response("Invalid JSON from LLM", { status: 500 });
	// };

	return JSON.parse(cleanedResponse);
};