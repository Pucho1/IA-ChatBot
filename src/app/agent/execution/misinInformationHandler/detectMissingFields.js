/**
 * NO interpreta lenguaje,NO razona, NO genera plan
 */

import { success } from "zod";

export class MissingInfoGuard {

  check({ args, schema }) {
    const shape = schema.shape;
    const missing = [];

    console.log(`estos son los argumentos que me llegan al validador de argumento pa por si fata alguno ----->>>>>>`, args);

    for (const key in shape) {
      if (args[key] === undefined || args[key] === '' ) {
        missing.push(key);
      };
    };

    if (missing.length > 0) {
      return {
        blocked: true,
        missingFields: missing,
      };
    };

    return { blocked: false };
  };
  
};
