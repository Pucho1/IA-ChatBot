
import { summarizeConversation } from "@/app/intelligence/feedback/summarizeConversation";
import { materializeFacts } from "./materializeFacts";
import { maybeExtractFacts } from "@/app/intelligence/maybeExtractFacts";


/** Numero maximo de mensajes recientes que se conservan sin resumir. */
const MAX_MESSAGES = 10;

/**
 * Gestiona la memoria conversacional del agente.
 *
 * La memoria mantiene tres piezas de informacion dentro de `state`:
 * - `messages`: mensajes recientes de usuario y asistente.
 * - `facts`: hechos conocidos del usuario, extraidos de sus mensajes.
 * - `summary`: resumen de los mensajes que dejaron de estar en la ventana reciente.
 *
 * Tambien decide como resolver conflictos entre hechos nuevos y existentes,
 * y construye el contexto que consumira el modelo de lenguaje.
 */
export class Memory {

    /**
     * Crea una fachada sobre el estado compartido de una sesion.
     *
     * @param {object} state Estado mutable de la sesion del agente.
     * @param {Array} state.messages Lista de mensajes de la conversacion.
     * @param {Array} state.facts Hechos conocidos del usuario.
     * @param {Array} state.summary Resumen de la conversacion.
     */
    constructor(state) {
        this.state = state;
    };

    /**
     * Anade un mensaje de usuario a la conversacion.
     *
     * @param {*} content Contenido del mensaje recibido.
     * @returns {void}
     */
    #addUserMessage(content) {
        this.state.messages.push({
            role: "user",
            content
        });
    };

    /**
     * Anade una respuesta del asistente a la conversacion.
     *
     * @param {*} content Contenido de la respuesta.
     * @returns {void}
     */
    #addAssistantMessage(content) {
        this.state.messages.push({
            role: "assistant",
            content
        });
    };

    /**
     * Decide como resolver un hecho nuevo frente a uno ya almacenado.
     *
     * Las reglas priorizan los hechos proporcionados por el usuario, evitan
     * duplicados, protegen los hechos duros frente a inferencias y acumulan
     * valores distintos cuando el hecho existente es blando.
     *
     * @param {object|undefined} existing Hecho activo ya almacenado.
     * @param {object} candidate Hecho materializado que se quiere guardar.
     * @returns {{type: string, reason?: string}} Accion a realizar: `CREATE`,
     *   `REPLACE`, `APPEND`, `IGNORE` o `MARK_CONFLICT`.
     */
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

    /**
     * Aplica las acciones de resolucion y actualiza los hechos de la sesion.
     *
     * Los hechos nuevos se crean, reemplazan o acumulan segun el resultado de
     * {@link #resolveFact}. Los conflictos marcados no se modifican aqui.
     *
     * @param {object[]} materializedFacts Hechos listos para almacenar.
     * @returns {void}
     */
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
     * Extrae hechos de un mensaje y los almacena tras materializarlos.
     *
     * @param {*} rawMessage Mensaje entrante del usuario.
     * @returns {Promise<void>} Promesa que termina cuando los hechos se guardan.
     */
    async #processIncomingFacts(rawMessage) {

        const extracted = await maybeExtractFacts(rawMessage);
        const materialized = materializeFacts(extracted);

        this.#storeFact( materialized );
    };

    /**
     * Convierte los hechos conocidos al formato de mensaje para el prompt.
     * Si no existen hechos, devuelve una lista vacia.
     *
     * @returns {Array<{role: string, content: string}>} Mensajes de contexto.
     */
    #getfactsForPrompt() {
        return( this.state.facts.length
            ?   [
                    {
                        role: "system",
                        content: "Hechos conocidos sobre el usuario (úsalos solo si son relevantes para responder, " +
                        "no los repitas explícitamente a menos que el usuario lo pida):\n" +
                        this.state.facts.map(fact => `- ${fact.key}: ${fact.value}`).join("\n")
                    }
                ]
            :   []
        );
    };

    /**
     * Devuelve una vista del contexto actual que puede usar el agente.
     * Incluye mensajes, hechos formateados y un resumen por defecto cuando
     * todavia no se ha generado ninguno.
     *
     * @returns {{messages: Array, facts: Array, summary: Array}} Contexto actual.
     */
    getState(){
        const sumaryMessage = this.state.summary?.length
            ? this.state.summary
            : [{ role: "system", content: "No conversation summary" }];
        
        return { 
            messages: this.messages,
            facts:  this.#getfactsForPrompt(),
            summary: sumaryMessage,
        };
    };

    /**
     * Resume los mensajes antiguos cuando se supera la ventana reciente.
     * Conserva los ultimos {@link MAX_MESSAGES} mensajes y combina los
     * anteriores con el resumen existente antes de reemplazarlos.
     *
     * @returns {Promise<void>} Promesa que termina cuando el resumen se actualiza.
     */
    async #updateSummaryIfNeeded(){
         if (this.state.messages.length > MAX_MESSAGES) {

            const overflow = this.state.messages.length - MAX_MESSAGES;

            const oldMessages = this.state.messages.slice(0, overflow); // obtengo todos los mensajes antiguos

            const recentMessages = this.state.messages.slice(-MAX_MESSAGES); // obtengo todos los mensajes recientes

            // Función para resumir la conversación
            let summarytext = await summarizeConversation([
                this.state.summary[0] ? {...this.state.summary[0]} : {role:"system", content: "No conversation summary"},
                ...oldMessages,
            ]);

            this.state.summary =[ {
                role:"system",
                content: summarytext,
            }];

            this.state.messages = recentMessages;
        };
    };


    /**
     * Procesa un mensaje del usuario de principio a fin.
     * Lo agrega a la conversacion, extrae sus hechos y actualiza el resumen
     * si la cantidad de mensajes supera el limite configurado.
     *
     * @param {*} message Mensaje recibido del usuario.
     * @returns {Promise<void>} Promesa que termina al completar el procesamiento.
     */
    async handlerUserInput(message) {

        this.#addUserMessage(message);

        await this.#processIncomingFacts(message);

        await this.#updateSummaryIfNeeded();
    };

    
    /**
     * Guarda una respuesta del agente en la conversacion.
     * El parametro `source` se acepta por compatibilidad, pero actualmente
     * no modifica el mensaje almacenado.
     *
     * @param {*} response Respuesta generada por el agente.
     * @param {string} [source='system'] Origen logico de la respuesta.
     * @returns {void}
     */
    addAssistantResponse(response, source = 'system') {
        this.#addAssistantMessage(response);
    };

    /**
     * Obtiene los mensajes almacenados de la sesion.
     *
     * @returns {Array} Mensajes recientes de la conversacion.
     */
    get messages() {
        return this.state.messages;
    };

    /**
     * Obtiene los hechos almacenados de la sesion.
     *
     * @returns {Array} Hechos conocidos del usuario.
     */
    get facts() {
        return this.state.facts;
    };

    /**
     * Obtiene el resumen almacenado de la conversacion.
     *
     * @returns {Array} Mensajes que representan el resumen.
     */
    get summary() {
        return this.state.summary;
    };
};
