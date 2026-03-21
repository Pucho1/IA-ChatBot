/**
 *  validar plan
    encontrar pasos ejecutables
    actualizar estado de pasos
    detectar finalización
    detectar fallos
 */

export class PlanGraph {

  constructor(steps = []) {
    this.steps = steps.map(step => ({
      ...step,
      status: step.status || "pending",
      result: null,
      error: null,
    }));

    this.validate();
  };

  /**
   * Verifica el plan.
   */
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

    // comprobar dependencias válidas
    for (const step of this.steps) {
      for (const dep of step.depends_on) {

        // verifico que los id dentro del arry de dependencias de cada paso exista o sea sea un id de algun otro paso.
        const exists = this.steps.find(s => s.id === dep);

        if (!exists) {
          throw new Error(`Step ${step.id} depends on missing step ${dep}`);
        };
      };
    };
  };

  /**
   * Devuelve los pasos que tienen status = pending y todas sus dependencias están completadas.
   * @param {*} plan 
   * @returns Arry de pasos ejecutables.
   */
  getExecutableSteps() {

    return this.steps.filter(step => {

      // descartas cualquier paso que ya se esté ejecutando (running),
      // que haya fallado (failed) o que ya esté terminado (completed). 
      // Si no está pendiente, no nos interesa.
      if (step.status !== "pending") {
        return false;
      };

      // Verifica que todas las dependencias de este paso se hayan completado exitosamente
      //  antes de considerar este paso como ejecutable.
      const depsCompleted = step.depends_on.every(depId => {
        const dep = this.steps.find(s => s.id === depId);
        return dep && dep.status === "completed";
      });

      // Si el paso está pendiente y todas sus dependencias están completadas,
      //  el filtro devuelve true.
      return depsCompleted;
    });

  };

  /**
   * Marca a un step en proceso de ejecucion.
   * @param {*} stepId id del paso.
   */
  markRunning(stepId) {

    const step = this.#stepExist(stepId);

    step.status = "running";
  };

  /**
   * Marca a un step como ejecutado y guarda el resultado.
   * @param {*} stepId id del paso.
   */
  markCompleted(stepId, result) {

    const step = this.#stepExist(stepId);

    step.status = "completed";
    step.result = result;
  };

  /**
   * Marca a un step como fallido y guarda el por que.
   * @param {*} stepId 
   * @param {*} error 
   */
  markFailed(stepId, error) {
    const step = this.#stepExist(stepId);

    step.status = "failed";
    step.error = error;
  };

  /**
   * Verifico que todos los pasos esten completados.
   * @returns boolean
   */
  isComplete() {

    return this.steps.every(step =>
      step.status === "completed"
    );
  };

  /**
   * Verifico si algun paso ha fallado.
   * @returns boolean
   */
  hasFailures() {
    return this.steps.some(step =>
      step.status === "failed"
    );
  };

  /**
   * Verifica si un step existe. 
   * @param {*} stepId id del step.
   * @returns El step en cuestion.
   */
  #stepExist (stepId) {
    const step = this.steps.find(s => s.id === stepId);

    if (!step) {
      throw new Error(`Step ${stepId} not found`);
    };
    return step;
  };
};
