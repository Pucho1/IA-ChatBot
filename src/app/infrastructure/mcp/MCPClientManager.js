import { MCPClient } from "./MCPClient.js";

// Esta clase es un objeto que administra un recurso de larga duración.
// - gestionar la instancia del cliente
// - controlar initialization
// - evitar conexiones duplicadas
// - mantener el catálogo de tools
// - reutilizar el cliente
// - ejecutar tools

export class MCPClientManager {
  constructor(tokenProvider) {
    this.tokenProvider = tokenProvider;

    this.client = null;
    this.tools = null;
    this.initializationPromise = null;
  };

  /**
   * Inicializa el cliente MCP. Si ya está inicializado, no hace nada. Si ya hay una inicialización en curso, espera a que termine.
   * @returns 
   */
  async initialize() {
    // Si el cliente ya está inicializado, no hace nada
    if (this.client) {
      return;
    }
    // Si ya hay una inicialización en curso, espera a que termine
    if (this.initializationPromise) {
      return this.initializationPromise; // esto como es una  no habria que esperarla
    }
    
    
    console.log("MCPClientManager: Initializing MCP client...");

    // revisar este flujo 
    this.initializationPromise = this.#initializeInternal();

    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
  };

  /**
   * Inicializa el cliente MCP y obtiene la lista de herramientas. 
   * Este método es privado y solo debe ser llamado desde `initialize()`.
   * @returns 
   */
  async #initializeInternal() {
    const client = new MCPClient(this.tokenProvider);

    await client.connect();

    const tools = await client.listTools();

    this.client = client;
    this.tools = tools;
  };

  /**
   *  Devuelve la lista de herramientas disponibles en el cliente MCP. Si el cliente no está inicializado, lo inicializa primero.
   * @returns Lista de herramientas disponibles en el cliente MCP.
   */
  async getTools() {
    await this.initialize();

    return this.tools;
  };

  /**
   * Llama a una herramienta disponible en el cliente MCP. Si el cliente no está inicializado, lo inicializa primero.
   * @param {*} name 
   * @param {*} args 
   * @returns  Resultado de la llamada a la herramienta.
   */
  async callTool(name, args) {
    await this.initialize();

    console.log(`MCPClientManager: Calling tool ${name} with args:`, args);

    if (!this.client) {
      throw new Error("MCP client not initialized");
    }

    return this.client.callTool(name, args);
  };
};
