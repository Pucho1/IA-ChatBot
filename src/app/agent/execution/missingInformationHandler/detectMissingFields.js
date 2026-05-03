export class MissingInfoGuard {
  check({ args, schema }) {
    const shape = schema.shape;
    const missing = [];

    for (const key in shape) {
      if (args[key] === undefined || args[key] === "") {
        missing.push(key);
      }
    }

    if (missing.length > 0) {
      return {
        blocked: true,
        missingFields: missing,
      };
    }

    return { blocked: false };
  }
}
