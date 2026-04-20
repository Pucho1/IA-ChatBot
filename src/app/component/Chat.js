'use client';
import useChat from "./useChat";
import React, { useEffect, useRef } from 'react';

export function Chat() {
    // 1. Necesitamos una referencia para el div vacío al final
    const messagesEndRef = useRef(null);
    
    const { input, messages, loading, handleInputChange, handleSubmit } = useChat();

    const scrollToBottom = () => {
        // Asegúrate de usar el nombre correcto de la referencia
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]); // Se dispara cada vez que llegan mensajes nuevos

    return (
        <div className="flex flex-col w-screen h-screen px-20 py-10 gap-4 overflow-hidden">
            
            {/* 2. Contenedor de mensajes con scroll propio */}
            <div className="flex-1 overflow-y-auto pr-4 space-y-4">
                {messages.map((msg, index) => (
                    <div 
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} w-full`} 
                        key={index}
                    >
                        <p className={`p-3 rounded-lg max-w-[80%] text-white ${
                            msg.role === "user" 
                                ? "bg-black" 
                                : "bg-gray-900"
                        }`}>
                            {msg.content}
                        </p>
                    </div>
                ))}
                
                {/* 3. El ANCLA: Este div es el que "jala" el scroll hacia abajo */}
                <div ref={messagesEndRef} />
            </div>

            {/* 4. Formulario fijo abajo */}
            <form className="flex flex-col gap-4 mt-auto" onSubmit={handleSubmit}>
                <label className="font-semibold text-gray-700">Dime qué necesitas saber</label>
                <div className="flex gap-2">
                    <input
                        className="flex-1 border border-gray-300 rounded-full px-6 py-3 focus:outline-none focus:ring-2 focus:ring-gray-900"
                        type="text"
                        name="content"
                        placeholder="Escribe aquí..."
                        value={input}
                        onChange={handleInputChange} 
                    />
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="bg-gray-900 text-white px-6 py-2 rounded-full disabled:opacity-50"
                    >
                        {loading ? '...' : 'Enviar'}
                    </button>
                </div>
            </form>
        </div>
    );
};
