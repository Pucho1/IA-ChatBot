import { z } from "zod";


export const executionTools = [
  {
    name: "getCurrentDate",
    description: "Returns the current system date",
    schema: z.object({}),
    handler: async () => new Date().toISOString(),
  },

  {
    name: "searchFlights",
    description: "Search available flights",
    schema: z.object({
      date: z.string(),
      from: z.string(),
      to: z.string(),
    }),
    handler: async ({ date, from, to }) => {
      return [
        { flightId: "IB123", price: 120 },
        { flightId: "UX456", price: 150 },
      ];
    },
  },

  {
    name: "bookFlight",
    description: "Book a flight",
    schema: z.object({
      flightId: z.string(),
      passengerName: z.string(),
    }),
    handler: async (data) => ({
      confirmation: "CONF-123",
      ...data,
    }),
  },
];