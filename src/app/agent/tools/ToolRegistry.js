
/**
 * Registro centralizado de las herramientas disponibles para el agente.
 *
 * Las herramientas se separan en dos categorias:
 * - Cognitivas: ayudan al agente a razonar o construir planes.
 * - De ejecucion: realizan acciones externas o modifican el estado del sistema.
 *
 * Cada herramienta debe proporcionar, como minimo, un nombre y un schema
 * capaz de convertirse al formato de parametros esperado por el LLM.
 */
export class ToolRegistry {
  /**
   * Crea un registro vacio para herramientas cognitivas y de ejecucion.
   */
  constructor() {
    this.executionTools = new Map();
    this.cognitiveTools = new Map();
  }

  

  /**
   * Registra una herramienta de ejecucion.
   *
   * No permite registrar dos herramientas con el mismo nombre dentro de
   * la categoria de ejecucion.
   *
   * @param {object} tool Definicion de la herramienta a registrar.
   * @param {string} tool.name Nombre unico de la herramienta.
   * @param {object} tool.schema Schema de validacion de sus argumentos.
   * @throws {Error} Si la definicion es invalida o el nombre ya existe.
   */
  registerExecution(tool) {
    this.#validateTool(tool);

    if (this.executionTools.has(tool.name)) {
      throw new Error(`Execution tool "${tool.name}" already registered`);
    }

    this.executionTools.set(tool.name, tool);
  };

  /**
   * Registra una herramienta cognitiva.
   *
   * No permite registrar dos herramientas con el mismo nombre dentro de
   * la categoria cognitiva.
   *
   * @param {object} tool Definicion de la herramienta a registrar.
   * @param {string} tool.name Nombre unico de la herramienta.
   * @param {object} tool.schema Schema de validacion de sus argumentos.
   * @throws {Error} Si la definicion es invalida o el nombre ya existe.
   */
  registerCognitive(tool) {
    this.#validateTool(tool);

    if (this.cognitiveTools.has(tool.name)) {
      throw new Error(`Cognitive tool "${tool.name}" already registered`);
    };

    this.cognitiveTools.set(tool.name, tool);
  };

  /**
   * Comprueba que una herramienta tenga los datos minimos requeridos.
   *
   * Actualmente se validan `name` y `schema`. Aunque una herramienta pueda
   * incluir un `handler`, este metodo no exige su presencia.
   *
   * @param {object} tool Definicion de herramienta que se quiere comprobar.
   * @throws {Error} Si falta el nombre o el schema.
   */
  #validateTool(tool) {
    if (!tool?.name || !tool?.schema) {
      throw new Error(
          `Invalid tool definition: ${tool?.name}`
      );
    }
  }


  // =============================
  // MANIFESTS
  // =============================

  /**
   * Convierte las herramientas de ejecucion al manifiesto para el LLM.
   *
   * @returns {object[]} Funciones con nombre, descripcion y parametros JSON.
   */
  getExecutionManifest() {
    return Array.from(this.executionTools.values()).map(this.#toLLMFormat);
  };

  /**
   * Convierte las herramientas cognitivas al manifiesto para el LLM.
   *
   * @returns {object[]} Funciones con nombre, descripcion y parametros JSON.
   */
  getCognitiveManifest() {
    return Array.from(this.cognitiveTools.values()).map(this.#toLLMFormat);
  };

  /**
   * Adapta una herramienta interna al formato de tool calling del LLM.
   * Elimina la propiedad `$schema` porque el proveedor espera solo el schema
   * de parametros funcionales.
   *
   * @param {object} tool Herramienta cuyo schema se va a serializar.
   * @returns {{type: "function", function: object}} Representacion para el LLM.
   */
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
   * Comprueba si existe una herramienta de ejecucion con el nombre indicado.
   * Las herramientas cognitivas no se consultan con este metodo.
   *
   * @param {string} name Nombre de la herramienta.
   * @returns {boolean} `true` si esta registrada; en caso contrario, `false`.
   */
  has(name) {
    return this.executionTools.has(name);
  };

  /**
   * Obtiene una herramienta de ejecucion por su nombre.
   *
   * @param {string} name Nombre de la herramienta.
   * @returns {object|undefined} Herramienta registrada o `undefined` si no existe.
   */
  get(name) {
    return this.executionTools.get(name);
  };

  /**
   * Lista los nombres de todas las herramientas de ejecucion registradas.
   *
   * @returns {string[]} Nombres de las herramientas de ejecucion.
   */
  listExecution() {
    return Array.from(this.executionTools.keys());
  };

  /**
   * Obtiene las capacidades declaradas por una herramienta de ejecucion.
   *
   * @param {string} toolName Nombre de la herramienta.
   * @returns {Array} Capacidades declaradas o un array vacio si no existe
   *   o no declara capacidades.
   */
  getExecutionCapabilities(toolName) {
    return this.executionTools.get(toolName)?.capabilities ?? [];
  };

};
