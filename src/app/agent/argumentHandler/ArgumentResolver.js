/**
 * Coordina la resolucion de argumentos faltantes para una herramienta.
 *
 * Conserva los argumentos proporcionados inicialmente y consulta una lista
 * ordenada de resolvers para completar los campos que no tienen valor. El
 * orden de `resolvers` determina la prioridad de las fuentes de informacion.
 */
export class ArgumentResolver {
  /**
   * Crea un resolver de argumentos con sus estrategias de resolucion.
   *
   * @param {object} [params] Opciones de configuracion.
   * @param {object[]} [params.resolvers=[]] Resolvers que implementan
   *   `canResolve(field, context)` y `resolve(field, context)`.
   */
  constructor({ resolvers = [] } = {}) {
    this.resolvers = resolvers;
  };

  /**
   * Completa los argumentos faltantes usando los resolvers configurados.
   *
   * Para cada campo definido por `schema.shape`, los valores ya presentes se
   * conservan. Los campos vacios se ofrecen a los resolvers en orden; el
   * primer valor no vacio obtenido se asigna al resultado. Si ningun resolver
   * puede completarlo, el campo se incluye en `missingFields`.
   *
   * @param {object} params Parametros de resolucion.
   * @param {object} params.args Argumentos iniciales de la herramienta.
   * @param {object} params.schema Schema cuya propiedad `shape` define los campos.
   * @param {object} params.state Estado actual del agente.
   * @param {object} memory Memoria del agente, usada para exponer sus hechos.
   * @returns {Promise<{resolvedArgs: object, missingFields: string[]}>}
   *   Argumentos completados y nombres de los campos que siguen faltando.
   */
  async resolve({ args, schema, state, memory }) {
    const resolved = { ...args }; // objeto con todos los argumnetos resueltos por el llm, creo una copio para no romper nada.
    const missingFields = [];

    const shape = schema.shape; // argumentos obtenidos del esquema de la tool.

    const context = this.#createContext(args, state, memory, schema);

    // Loop por schema
    for (const field in shape) {

      // 1. si ya existe → continuar
      if (resolved[field] !== undefined && resolved[field] !== "") {
        resolved[field] = args[field];
        continue;
      };

      let value;

      // 2. intentar resolver con cada uno de los reslver que tengo y el orden importa ya que vamos 
      // buscando primero en los lugres con mas relevancia.
      for (const resolver of this.resolvers) {
        if (resolver.canResolve(field, context)) {
          value = await resolver.resolve(field, context);

          console.log("Resolver trace:", {
            field,
            resolver: resolver.constructor.name,
            value,
          });

          // si lo logro resolver con alguno no pregunto salgo del loop.
          if (value !== undefined && value !== null && value !== "") {
            resolved[field] = value;
            break;
          };
        };
      };

      // 3. si no se resolvió → marcar missing
      if (!resolved[field]) {
        missingFields.push(field);
      };
    };

    return {
      resolvedArgs: resolved,
      missingFields,
    };
  };

  /**
   * Construye el contexto compartido que reciben los resolvers.
   *
   * Ademas de los argumentos y el schema, incluye la entrada actual, el
   * estado, el historial, los hechos disponibles en memoria y el ultimo paso
   * registrado de la ejecucion.
   *
   * @param {object} args Argumentos iniciales de la herramienta.
   * @param {object} state Estado actual del agente.
   * @param {object} memory Memoria del agente.
   * @param {object} schema Schema de la herramienta.
   * @returns {{args: object, state: object, currentInput: *, schema: object,
   *   history: Array, facts: Array, lastStep: object|undefined}} Contexto para
   *   las estrategias de resolucion.
   */
  #createContext(args, state, memory, schema) {
    return {
      args,
      state,
      currentInput: state.currentInput,
      schema,
      history: state.history,
      facts: memory.facts || [],
      lastStep: state.history[state.history.length - 1],
    };
  };

};


