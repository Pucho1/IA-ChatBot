export class HistoryResolver {

    /**
     * Verirfica si dentro de mi contexto tegno history y si history tiene datos.
     * @param {*} field 
     * @param {*} context 
     * @returns boolean
     */
  canResolve(field, context) {
    return context.history && context.history.length > 0;
  };

  resolve(field, context) {
    const { history } = context;

    // recorrer hacia atrás (más reciente → más antiguo)
    for (let i = history.length - 1; i >= 0; i--) {
      const step = history[i];

      // 🔹 aquí depende de tu estructura real
      const text =
        step?.decision?.output ||
        step?.observation?.toolResults ||
        "";

      // 🔹 ejemplo muy simple (mejorarás luego)
      if (field === "passengerName") {
        const match = text.match(/para (\w+)/i);
        if (match) {
          return match[1];
        };
      };
    };

    return undefined;
  };
};
