'use client';

import { useState } from "react";

const useChat = () => {

	const [input, setInput] = useState("");
	const [messages, setMessages] = useState([]);
	const [loading, setLoading] = useState(false);

	const handleInputChange = (e) => {
		setInput(e.target.value);
	};

	const handleSubmit = async (e) => {
		e.preventDefault();

		if (!input.trim()) return;
		const userMessage = { role: "user", content: input };


		setMessages((prevMessages) => [...prevMessages, userMessage]);
		setInput("");
    	setLoading(true);

		// hago fetch y quedo a la espera de una respuesta, pero no de una respuesta cerrada (JSON), sino de una conexión abierta.
		// El servidor envía un trozo de datos al navegador. El navegador lo guarda en un buffer (una memoria temporal).
		const response = await fetch("/api/completion/stream", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				messages: input,
			}),
		});

		// creamos el lector del stream de la respuesta( "objeto de tipo ReadableStream" )  al cual le llegaran
		// datos poco a poco segun los envie el servidor con el enqueue el controller redeablestream
		const reader = response.body.getReader();
		
    	const decoder = new TextDecoder(); // Para convertir bytes a texto

		let assistantText = "";


		// Forma de decir: "Sigue pidiendo datos indefinidamente hasta que el objeto que me devuelvas diga { done: true }
		// lo que me devuelve el back es una promesa que se resuelve en un objeto { done, value }
		//  y no un arreglo de promesas como lo devuelve la api de openai
		while (true) {

			const { done, value } = await reader.read(); //Dame lo que tengas en la memoria temporal ahora mismo
			if (done) break; // Si ya no hay más datos, salimos del bucle


			const chunk = decoder.decode(value); // Decodificamos el binario a texto
      		assistantText += chunk; // Acumulamos el texto recibido hasta ahora asi hace el efecto "streaming"

			setMessages(prev => {
				const last = prev[prev.length - 1];  // Obtengo el último mensaje (que debería ser del asistente si ya el stream habia metido algo	)

				if (last?.role === "assistant") { // Si el último mensaje es del asistente, le añado el nuevo texto
					return [...prev.slice(0, -1), {...last,  content: assistantText }];
				}

				return [...prev, { role: "assistant", content: assistantText }];
			});
		}
		setLoading(false);
	};

	// console.log("useChat messages:", messages);
  
  return {
		input,
		messages,
		loading,
		handleInputChange,
		handleSubmit,
	};
};

export default useChat;
