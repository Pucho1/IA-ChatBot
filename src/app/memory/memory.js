import { maybeExtractFacts } from "../intelligence/maybeExtractFacts";
import { summarizeConversation } from "../intelligence/summarizeConversation";
import { materializeFacts } from "./materializeFacts";

const MAX_MESSAGES = 10;

/**
 * Memory encapsula el conocimiento del estado conversacional
 * Decide cómo se guardan mensajes
 * Decide cómo se almacenan facts
 * Decide cómo se resuelven conflictos
 * Decide cuándo resumir
 * Construye el contexto para el LLM
 */
export class Memory {

    constructor(state) {
        this.state = state;
    };

    #addUserMessage(content) {
        this.state.messages.push({
            role: "user",
            content
        });
    };

    #addAssistantMessage(content) {
        this.state.messages.push({
            role: "assistant",
            content
        });
    };


    #resolveFact(existing, candidate){
                
        // Caso A — No existe
        if (!existing) {
            return { type: "CREATE" };
        }

        // Caso B — Existe y es igual
        if (existing.value === candidate.value) {
            return { type: "IGNORE" };
        }

        // Caso C — El usuario manda
        if (candidate.source === "user") {
            return { type: "REPLACE" };
        }

        // Inferido nunca pisa user
        if (
            candidate.source === "inferred" &&
            existing.source === "user"
        ) {
            return { type: "IGNORE" };
        }

        // Hard facts no se pisan por inferencias
        if (
            existing.type === "hard" &&
            candidate.source === "inferred"
        ) {
            return {
            type: "MARK_CONFLICT",
            reason: "hard_fact_conflict",
            };
        }

        // Soft facts → usar confianza
        if (existing.type === "soft") {
            const values = Array.isArray(existing.value)
                ? existing.value // si es un arry guardo el arry completo 
                : [existing.value]; // si no creo un arry y guardo el value del qeu existe como arry 

            if (values.includes(candidate.value)) { // si es soft y tienen el mismo value lo ignoro
                return { type: "IGNORE" };
            };

            return { type: "APPEND" };
        };

        // Fallback defensivo
        return { type: "IGNORE" };
    };

    #storeFact(materializedFacts) {
        for ( const factCandidate of materializedFacts ) {

            // determino si este fact ya existe y gestione conflictos.
            const existing = this.state.facts.find(fact => fact.key === factCandidate.key && fact.status === "active");

            const action = this.#resolveFact(existing, factCandidate);

            switch (action.type) {
                case "CREATE":
                    this.state.facts.push(factCandidate);
                    break;

                case "REPLACE":
                    existing.value = factCandidate.value;
                    existing.updatedAt = Date.now();
                    break;

                case "APPEND":
                    existing.value = `${existing.value}; ${factCandidate.value}`;
                    existing.updatedAt = Date.now();
                    break;

                case "IGNORE":
                default:
                break;
            };
        };
    };

    /**
     * Ananlisa cada mensaje para saber si este contine un fact o no.
     * @param {*} rawMessage mensaje entrante del  usuario.
     */
    async #processIncomingFacts(rawMessage) {

        const extracted = await maybeExtractFacts(rawMessage);
        const materialized = materializeFacts(extracted);

        this.#storeFact( materialized );
    };

    /**
     * Construlle e promp que le vamos a pasar al LLM
     * @returns Promp que le vamos a pasar al LLM
     */
    buildPrompt() {

        // Definimos el comportamiento aquí
        
        // Interpretar intención
        // Clasificarla
        // Estructurarla
        const systemMessage = {
            role: "system",
            content: `
                Eres un asistente conversacional.

                Debes responder SIEMPRE en formato JSON válido con esta estructura:

                {
                    "type": "message" | "action",
                    "content": string,          // si es mensaje
                    "action": string | null,    // si es acción
                    "payload": object | null    // datos de la acción
                }

                Si solo es conversación normal:
                type = "message"

                Si el usuario pide hacer algo:
                type = "action"
            `,
        };

        const messagesToSend  = [
            // retorno el array de mensajes a enviar al modelo
            //  system + facts +  resumen (si lo hay) + mensajes recientes
            systemMessage,
            ...(this.state.facts.length
            ?   [
                    {
                        role: "system",
                        content: "Hechos conocidos sobre el usuario (úsalos solo si son relevantes para responder, " +
                        "no los repitas explícitamente a menos que el usuario lo pida):\n" +
                        // this.state.facts.map(fact => `- ${fact}`).join("\n"),
                        this.state.facts.map(fact => `- ${fact.key}: ${fact.value}`).join("\n")
                    }
                ]
            :   []
            ),
            ...(this.state.summary ? this.state.summary : []),
            ...this.state.messages
        ];

        return messagesToSend;
    };

    /**
     * Se crea y modifica el resumen si hiciera falta.
     */
    async #updateSummaryIfNeeded(){
         if (this.state.messages.length > MAX_MESSAGES) {

            const overflow = this.state.messages.length - MAX_MESSAGES;

            const oldMessages = this.state.messages.slice(0, overflow); // obtengo todos los mensajes antiguos

            const recentMessages = this.state.messages.slice(-MAX_MESSAGES); // obtengo todos los mensajes recientes

            // Función para resumir la conversación
            let summarytext = await summarizeConversation([
                { ...this.state.summary[0] },
                ...oldMessages,
            ]);

            this.state.summary =[ {
                ...this.state.summary[0],
                content: summarytext,
            }];

            this.state.messages = recentMessages;
        };
    };


    /**
     * Gestiona que hacer con el mensaje del usuario
     * @param {*} message 
     */
    async handlerUserInput(message) {

        this.#addUserMessage(message);

        await this.#processIncomingFacts(message);

        await this.#updateSummaryIfNeeded();
    };

    /**
     * Proveeo una manera de almacenar la salida del sistema
     */
    addAssistantResponse(text) {
        this.#addAssistantMessage(text);
    }

    get messages() {
        return this.state.messages;
    };

    get facts() {
        return this.state.facts;
    };

    get summary() {
        return this.state.summary;
    };
};
