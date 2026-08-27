import { z } from "zod";

/**
 * Herramientas internas que el agente puede ofrecer al LLM durante la fase
 * de razonamiento. `generatePlan` define el formato estructurado del plan
 * que debe devolver el modelo antes de ejecutar herramientas externas.
 */
export const cognitiveTools = [
  {
    name: "generatePlan",
    description: "Generate execution plan",
    schema: z.object({
      steps: z.array(
        z.object({
          id: z.coerce.number(),
          description: z.coerce.string(),
          tool: z.coerce.string(),
          args: z.record(z.string(), z.unknown()),
          depends_on: z.array(z.coerce.number()).default([]),
        })
      ),
    }),
    handler: async ({ steps }) => ({ steps }),
  },
];