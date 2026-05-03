import { z } from "zod";

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
          args: z.object({}),
          depends_on: z.array(z.coerce.number()).default([]),
        })
      ),
    }),
    handler: async ({ steps }) => ({ steps }),
  },
];