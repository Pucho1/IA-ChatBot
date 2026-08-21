
// esta capa se deberia combinar con la clase execute
//  para la validaion de lo que son los pasos las herramietas y su ejecucion
export class ToolRegistry {
  constructor() {
    this.executionTools = new Map();
    this.cognitiveTools = new Map();
  }

  

  /**
   * Registra una herramienta en el registry
   * @param {*} name 
   */
  registerExecution(tool) {
    this.#validateTool(tool);

    if (this.executionTools.has(tool.name)) {
      throw new Error(`Execution tool "${tool.name}" already registered`);
    }

    this.executionTools.set(tool.name, tool);
  };

  registerCognitive(tool) {
    this.#validateTool(tool);

    if (this.cognitiveTools.has(tool.name)) {
      throw new Error(`Cognitive tool "${tool.name}" already registered`);
    };

    this.cognitiveTools.set(tool.name, tool);
  };

  /**
   * Valida que mis tool cumplan con los requisitos minimos de nombre, handler y schema
   * @param {*} tool
   */
  #validateTool(tool) {
    if (!tool?.name || !tool?.handler || !tool?.schema) {
      throw new Error(`Invalid tool definition: ${tool?.name}`);
    }
  };


  // =============================
  // MANIFESTS
  // =============================

  /**
   *  Obtiene listado de las herramientas de ejecucion registradas en el registry
   * @returns 
   */
  getExecutionManifest() {
    return Array.from(this.executionTools.values()).map(this.#toLLMFormat);
  };

  getCognitiveManifest() {
    return Array.from(this.cognitiveTools.values()).map(this.#toLLMFormat);
  };

  #toLLMFormat(tool) {
    const jsonSchema = tool.schema.toJSONSchema();
    const { $schema, ...clean } = jsonSchema;

    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: clean,
      },
    };
  };




  // =============================
  // EXECUTION
  // =============================


  /**
   * comprueba si la herramienta esta registrada
   * @param {*} name 
   * @returns boolean
   */
  has(name) {
    return this.executionTools.has(name);
  };

  get(name) {
    return this.executionTools.get(name);
  };

  listExecution() {
    return Array.from(this.executionTools.keys());
  };


  /**
   * ejecuta la herramienta con los argumentos dados
   * @param {*} name
   * @param {*} args
   * @returns
   */
   async execute(name, args) {
    const tool = this.executionTools.get(name);

    if (!tool) {
      throw new Error(`Tool "${name}" not registered`);
    }

    const parsed = tool.schema.safeParse(args);

    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }

    const result = await tool.handler(parsed.data);

    return JSON.parse(JSON.stringify(result));
  };

};
