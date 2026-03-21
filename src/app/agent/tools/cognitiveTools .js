import { z } from "zod";

export const cognitiveTools = [
  {
    name: "generatePlan",
    description: "Generate execution plan",
    schema: z.object({
      steps: z.array(
        z.object({
          id: z.number(),
          description: z.string(),
          tool: z.string(),
          args: z.object({}).passthrough(),
          depends_on: z.array(z.number()).default([]),
        })
      ),
    }),
    handler: async ({ steps }) => ({ steps }),
  },
];