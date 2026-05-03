const isDebugEnabled =
  process.env.AGENT_DEBUG === "true" && process.env.NODE_ENV !== "production";

export const debug = {
  log(...args) {
    if (isDebugEnabled) {
      console.log(...args);
    }
  },

  warn(...args) {
    if (isDebugEnabled) {
      console.warn(...args);
    }
  },

  error(...args) {
    if (isDebugEnabled) {
      console.error(...args);
    }
  },
};
