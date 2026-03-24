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
      date: z.coerce.string().describe("fecha en la que se va a ralizar el viaje"),
      from: z.coerce.string().describe("desde donde se va a ralizar el viaje"),
      to: z.coerce.string().describe("hacia donde se va a ralizar el viaje"),
    }),
    handler: async ({ date, from, to }) => {
      return [
        { flightId: "IB123", price: 120, date: `Fecha de vuelo ${date} a las 11:54 AM` },
        { flightId: "UX456", price: 150, date: `Fecha de vuelo ${date} a las 23:15 AM` },
      ];
    },
  },

  {
    name: "bookFlight",
    description: "Book a flight",
    schema: z.object({
      flightId: z.coerce.string().describe("Id unico del vuelo"),
      passengerName: z.coerce.string().describe(" Nombre del pasajero a abordar"),
    }),
    handler: async (data) => ({
      confirmation: "CONF-123",
      ...data,
    }),
  },
];