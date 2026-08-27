/** Almacena estados de agente asociados a identificadores de sesion. */
export class AgentSessionStore {
  /** Crea un almacén de sesiones en memoria. */
  constructor() {
    this.sessions = new Map();
  };

  /** Obtiene el estado de una sesion. */
  get(sessionId) {
    return this.sessions.get(sessionId);
  };

  /** Guarda o reemplaza el estado de una sesion. */
  set(sessionId, state) {
    this.sessions.set(sessionId, state);
  };

  /** Elimina una sesion almacenada. */
  clear(sessionId) {
    this.sessions.delete(sessionId);
  };
};
