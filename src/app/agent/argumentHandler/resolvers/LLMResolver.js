export class LLMResolver {
  constructor({ llmClient }) {
    this.llm = llmClient;
  };

  canResolve(field, context) {
    return !!context.currentInput;
  };

  async resolve(field, context) {
    const { currentInput, schema } = context;

    const fieldSchema = schema.shape[field];

    // console.log("schema del field-*-*-*-*-*?>>>>>", {fieldSchema})

    const prompt = this.buildPrompt(currentInput, field, fieldSchema.description)

    const result = await this.llm().complete(
      {
        messages: prompt, // construyo el prompt con la memoria y se lo paso al LLM, espero su respuesta
        temperature: 0,
      }
    );
    console.log("este el resultado del resolve con llm-----+++---->>>>>>", result.choices[0].message )

    return this.clean(result.choices[0].message.content);
    
  };

  clean(value) {
    if (value === null || value === undefined) return null;

    // Convertimos a string por seguridad antes de limpiar
    const stringValue = String(value);

    if (stringValue.toLowerCase() === "null") return null;

    return stringValue.trim();
  };

  /**
   * Construye el prompt para el LLM basado en el estado actual del agente y la memoria.
   */
  buildPrompt(currentInput, field, fieldSchema) {
    return [
      {
        role: "system",
        content: `
          You are extracting structured data.

          User input:
          "${currentInput}"

          Field to extract:
          "${field}"

          Field description:
          "${fieldSchema.description}"

          Return ONLY the value or null.
        `
      }
    ];
  };
};
