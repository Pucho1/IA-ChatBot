import { z } from "zod";

export class MCPToolAdapter {
  adapt(tool) {
    if (!tool?.name || !tool?.inputSchema) {
      throw new Error(
        `Invalid MCP tool definition: ${tool?.name}`
      );
    }

    return {
      name: tool.name,
      description: tool.description ?? "",
      schema: this.#toZod(tool.inputSchema),
    };
  }

  #toZod(schema) {
    if (!schema || schema.type !== "object") {
      throw new Error(
        "MCP tool inputSchema must be an object schema"
      );
    }

    const shape = {};

    const properties = schema.properties ?? {};
    const required = new Set(schema.required ?? []);

    for (const [name, propertySchema] of Object.entries(properties)) {
      let field = this.#propertyToZod(propertySchema);

      if (!required.has(name)) {
        field = field.optional();
      }

      shape[name] = field;
    }

    return z.object(shape);
  }

  #propertyToZod(schema) {
    if (!schema?.type) {
      throw new Error(
        "MCP property schema must define a type"
      );
    }

    switch (schema.type) {
      case "string":
        if (Array.isArray(schema.enum)) {
          return z.enum(schema.enum);
        }

        return z.string();

      case "integer":
        return z.number().int();

      case "number":
        return z.number();

      case "boolean":
        return z.boolean();

      case "array":
        if (!schema.items) {
          throw new Error(
            "MCP array schema must define items"
          );
        }

        return z.array(
          this.#propertyToZod(schema.items)
        );

      case "object":
        return this.#toZod(schema);

      default:
        throw new Error(
          `Unsupported MCP schema type: ${schema.type}`
        );
    }
  }
}