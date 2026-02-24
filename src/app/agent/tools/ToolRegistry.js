import { zodToJsonSchema } from "zod-to-json-schema";


export class ToolRegistry {
  constructor() {
    this.tools = new Map();
  };

  /**
   * registra una herramienta en el registry
   * @param {*} name 
   * @param {*} handler 
   */
  register(tool) {
    if (!tool.name || !tool.handler || !tool.schema) {
      throw new Error("Tool inválida");
    };
    this.tools.set(tool.name, tool);
  };

  /**
   * comprueba si la herramienta esta registrada
   * @param {*} name 
   * @returns boolean
   */
  has(name) {
    return this.tools.has(name);
  };

  /**
   * Devuelve las definiciones de las herramientas registradas, para que el LLM sepa como usarlas
   * @returns 
   */
  getToolManifest() {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      schema: zodToJsonSchema( tool.schema.shape) // Zod no es JSON Schema. Debemos convertirlo a JSON Schema o a un formato simplificado.
    }));
  };

  /**
   * ejecuta la herramienta con los argumentos dados
   * @param {*} name 
   * @param {*} args 
   * @returns 
   */
  async execute(name, args) {

    const tool = this.tools.get(name);

    if (!tool) {
      throw new Error(`Tool "${name}" no registrada`);
    };

    const parsed = tool.schema.safeParse(args);

    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }

    return await tool.handler(args);
  };
};
