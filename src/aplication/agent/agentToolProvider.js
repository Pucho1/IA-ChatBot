import { ToolRegistry } from "@/app/agent/tools/ToolRegistry";
import { MCPToolAdapter } from "@/app/infrastructure/mcp/MCPToolAdapter.js";


/**
 * Clase que proporciona un registro de herramientas del agente, inicializándolo bajo demanda.
 * Permite registrar herramientas cognitivas y de ejecución provenientes de MCP.
 * La inicialización es perezosa y se realiza solo cuando se solicita el registro por primera vez.
 * Si ya hay una inicialización en curso, espera a que termine y devuelve el registro.
 * Si ya está inicializado, devuelve el registro directamente.
 */
export class AgentToolProvider {
  constructor({ mcpClientManager, cognitiveTools = [] }) {
    this.mcpClientManager = mcpClientManager;
    this.cognitiveTools = cognitiveTools;

    this.registry = null;
    this.initializationPromise = null;
  };

  /**
   *  Obtiene el registry de herramientas del agente, inicializándolo si es necesario.
   *  Si ya hay una inicialización en curso, espera a que termine y devuelve el registry.
   *  Si ya está inicializado, devuelve el registry directamente.
   * @returns Registry de herramientas del agente.
   */
  async getRegistry() {
    if (this.registry) {
      return this.registry;
    }

    if (!this.initializationPromise) { // Si no hay una inicialización en curso, inicia una nueva
      this.initializationPromise = this.#initialize(); // Inicia la inicialización y guarda la promesa
    }s

    return this.initializationPromise; // Si ya hay una inicialización en curso, espera a que termine y devuelve el registry
  };

  /**
   * Inicializa el registry de herramientas del agente.
   * @returns Registry de herramientas del agente.
   */
  async #initialize() {
    try {
      const registry = new ToolRegistry(); // instancia del registry de herramientas del agente
      const adapter = new MCPToolAdapter(); // instancia del adaptador de herramientas MCP a formato compatible con el registry

      // Cognitive tools actuales
      for (const tool of this.cognitiveTools) {
        registry.registerCognitive(tool);
      }

      // Execution tools provenientes de MCP
      const { tools } = await this.mcpClientManager.getTools(); // obtiene las herramientas del cliente MCP

      for (const tool of tools) {
        registry.registerExecution(
          adapter.adapt(tool)
        );
      }

      this.registry = registry; // almacena el registry de herramientas del agente para uso futuro

      return registry;
    } catch (error) {
      this.initializationPromise = null;
      throw error;
    }
  };
};
