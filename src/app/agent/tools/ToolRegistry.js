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

    // Esto es crucial para evitar conflictos de nombres y asegurar que cada herramienta tenga un identificador único.
    // Si el LLM intenta registrar una herramienta que ya existe, esto nos ayudará a detectar ese error rápidamente.
    if (this.tools.has(tool.name)) { 
      throw new Error(`Tool "${tool.name}" ya registrada`);
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

  get(name) {
    return this.tools.get(name);
  };

  list() {
    return Array.from(this.tools.keys());
  };

    /**
   * Devuelve las definiciones de las herramientas registradas, para que el LLM sepa como usarlas
   * @returns 
   */
  getToolManifest() {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      schema: zodToJsonSchema( tool.schem, {
          name: tool.name
      }) // Zod no es JSON Schema. Debemos convertirlo a JSON Schema o a un formato simplificado.
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
    };

    const result = await tool.handler(parsed.data);

    // Esto es un truco para asegurarnos de que el resultado es serializable, 
    // lo cual es crucial para que pueda ser enviado a través de la red o almacenado en la memoria del agente.
    return JSON.parse(JSON.stringify(result)); 
  };
};
