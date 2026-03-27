export class AgentSessionStore {
  constructor() {
    this.sessions = new Map();
  };

  get(sessionId) {
    return this.sessions.get(sessionId);
  };

  set(sessionId, state) {
    this.sessions.set(sessionId, state);
  };

  clear(sessionId) {
    this.sessions.delete(sessionId);
  };
};
