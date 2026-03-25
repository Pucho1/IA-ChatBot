export class DirectResolver {
    /**
     * Verifico si dentro de mis args esta el campo y si tiene valor.
     * @param {*} field campo de los args
     * @param {*} context contexto de busqueda
     * @returns boolean
     */
  canResolve(field, context) {
    const value = context.args[field];

    return value !== undefined && value !== null && value !== "";
  };

  /**
   * Devuelve el valor de esa propiedad definido en los argumentos proveidos por el llm
   * @param {*} field 
   * @param {*} context 
   * @returns any
   */
  resolve(field, context) {
    return context.args[field];
  };
};
