/** Mantiene los pasos de un plan y sus estados de ejecucion. */
export class PlanGraph {

  /** Inicializa los pasos y valida sus identificadores. */
  constructor(steps = []) {
    this.steps = steps.map(step => ({
      ...step,
      status: step.status || "pending",
      result: null,
      error: null,
    }));

    this.validate();
  };

  /** Verifica ids unicos y normaliza las dependencias. */
  validate() {

    const ids = new Set(); // permite almacenar valores únicos de cualquier tipo.

    // verifico si cada paso del plan creado tiene dependencias o no. y si tengo pasos duplicados.
    for (const step of this.steps) {

      // verifico si tengo pasos duplicados.
      if (ids.has(step.id)) {
        throw new Error(`Duplicate step id ${step.id}`);
      };

      ids.add(step.id);

      if (!Array.isArray(step.depends_on)) {
        step.depends_on = [];
      };
    };

  };

  /** Devuelve los pasos pendientes o bloqueados disponibles para ejecutar. */
  getExecutableSteps() {

    return this.steps.filter(step => {

      // descartas cualquier paso que ya se esté ejecutando (running),
      // que haya fallado (failed) o que ya esté terminado (completed). 
      // Si no está pendiente, no nos interesa.
      if (step.status !== "pending" && step.status !== "blocked") {
        return false;
      };

      // Verifica que todas las dependencias de este paso se hayan completado exitosamente
      //  antes de considerar este paso como ejecutable.
      // const depsCompleted = step.depends_on.every(depId => {
      //   const dep = this.steps.find(s => s.id === depId);
      //   return dep && dep.status === "completed";
      // });

      // Si el paso está pendiente y todas sus dependencias están completadas,
      //  el filtro devuelve true.
      return true;
       
  });

  };

  /** Marca un paso como actualmente en ejecucion. */
  markRunning(stepId) {

    const step = this.#stepExist(stepId);

    step.status = "running";
  };

  /** Marca un paso como completado y guarda su resultado. */
  markCompleted(stepId, result) {

    const step = this.#stepExist(stepId);

    step.status = "completed";
    step.result = result;
    step.error = null;
  };

  /** Marca un paso como fallido y guarda el error. */
  markFailed(stepId, error) {
    const step = this.#stepExist(stepId);

    step.status = "failed";
    step.error = error;
  };

  /** Marca un paso como bloqueado y registra la razon. */
  markBlocked(stepId, blokedReazon) {
    const step = this.#stepExist(stepId);

    step.status = "blocked";
    step.error = `El paso actual tiene el problema en: ${blokedReazon}`;
  };

  /** Devuelve un paso bloqueado al estado pendiente. */
  markPending(stepId) {
    const step = this.#stepExist(stepId);

    step.status = "pending";
  };

  /** Indica si todos los pasos estan completados. */
  isComplete() {
    return this.steps.every(step =>
      step.status === "completed"
    );
  };

  /** Indica si algun paso ha fallado. */
  hasFailures() {
    return this.steps.some(step =>
      step.status === "failed"
    );
  };

  /** Actualiza los argumentos de un paso existente. */
  updateStepArgs(stepId, newArgs) {
    const step = this.#stepExist(stepId);
    step.args = newArgs;
  };

  /** Obtiene un paso por id o lanza un error si no existe. */
  #stepExist (stepId) {
    const step = this.steps.find(s => s.id === stepId);

    if (!step) {
      throw new Error(`Step ${stepId} not found`);
    };
    return step;
  };
};
