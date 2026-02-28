import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod"

export class ToolRegistry {
  constructor() {
    this.tools = new Map();
  };

  /**
   * registra una herramienta en el registry
   * @param {*} name 
   * @param {*} handler 
   */
  register(tool = { 
    name: "getCurrentDate",
    description: "Returns the current system date",
    // Aquí definimos el ESQUEMA (El contrato) de lo que esta herramienta espera como argumentos.
    //  En este caso, no esperamos ningún argumento, pero podríamos definir esquemas más complejos para herramientas que sí los requieran.
    schema:z.object({}), // No parameters needed for this tool
    handler: async () => new Date().toISOString()
  }) {
    if (!tool.name || !tool.handler || !tool.schema || !tool.description) {
      throw new Error("Tool inválida: falta name, description, schema o handler");
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
   * Devuelve las definiciones de las herramientas registradas, para que el LLM sepa como usarlas.
   * Una declaración formal de capacidades disponibles en este runtime.
   * @returns 
   */
  getToolManifest() {
    return Array.from(this.tools.values()).map(tool => {
      const jsonSchema = zodToJsonSchema(tool.schema);
    
    // Eliminamos metadatos innecesarios para el LLM
    const { $schema, ...cleanSchema } = jsonSchema;

      return {
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: cleanSchema, // Schema limpio sin metadatos, para que el LLM pueda entender claramente qué argumentos necesita pasar al usar esta herramienta.
        }
      };
    });
  };

  /**
   * ejecuta la herramienta con los argumentos dados
   * @param {*} name 
   * @param {*} args 
   * @returns 
   */
  async execute(name, args) {

    console.log(`Ejecutando herramienta "${name}" con argumentos:--------------`, args);



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
