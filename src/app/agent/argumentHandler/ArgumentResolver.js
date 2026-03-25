export class ArgumentResolver {
  constructor({ resolvers = [] } = {}) {
    this.resolvers = resolvers;
  };

  /**
   * Gestiona la obtencion de los argumentos faltantes en el contexto del agente.
   * @param {*}  
   * @returns object type {resolvedArgs, missingFields }
   */
  resolve({ args, schema, state }) {
    const resolved = { ...args }; // objeto con todos los argumnetos resueltos por el llm, creo una copio para no romper nada.
    const missingFields = [];

    const shape = schema.shape; // argumentos obtenidos del esquema de la tool.

    const context = {
      args,
      state,
      history: state.history,
      facts: state.memory?.facts || [], // esto no existe en mi state
      lastStep: state.history[state.history.length - 1],
    };

    // Loop por schema
    for (const field in shape) {

      // 1. si ya existe → continuar
      if (resolved[field] !== undefined && resolved[field] !== "") {
        continue;
      };

      let value;

      // 2. intentar resolver con cada unbo de los reslver que tengo y el orden importa ya que vamos 
      // buscando pirmoero en los lugres con mas relevancia.
      for (const resolver of this.resolvers) {
        if (resolver.canResolve(field, context)) {
          value = resolver.resolve(field, context);

          // si lo logro resolver con alguno no pregunto salgo poor el break
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
};
