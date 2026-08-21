import { MCPClient } from "./MCPClient.js";

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
      return this.initializationPromise;
    }

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

  async getTools() {
    await this.initialize();

    return this.tools;
  };

  async callTool(name, args) {
    await this.initialize();

    if (!this.client) {
      throw new Error("MCP client not initialized");
    }

    return this.client.callTool(name, args);
  };
};
