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

  {
    name: "getWeather",
    description: "Obtiene las condiciones climáticas actuales de una ubicación específica.",
    
    // Esquema para el ArgumentNormalizer y el LLM
    schema: z.object({
      location: z.string()
        .describe("La ciudad y el país, ej: 'Madrid, ES' o 'Buenos Aires'"),
      unit: z.enum(["celsius", "fahrenheit"])
        .default("celsius")
        .describe("La unidad de medida de temperatura")
    }),

    // Handler determinista (Tu "Músculo")
    handler: async ({ location, unit }) => {
      try {
        // Aquí conectarías con una API real como OpenWeather o WeatherAPI
        // Por ahora, simulamos la respuesta determinista
        console.log(`[WeatherTool] Consultando clima para: ${location} en ${unit}...`);
        
        const mockData = {
          Madrid: { temp: 22, condition: "Soleado", humidity: 40 },
          London: { temp: 15, condition: "Luvioso", humidity: 80 },
          default: { temp: 20, condition: "Despejado", humidity: 50 }
        };

        const city = location.split(',')[0].trim();
        const data = mockData[city] || mockData.default;

        return {
          location: location,
          temperature: unit === "fahrenheit" ? (data.temp * 9/5) + 32 : data.temp,
          unit: unit,
          condition: data.condition,
          humidity: `${data.humidity}%`,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        throw new Error(`Error al obtener el clima: ${error.message}`);
      }
    }
  },

];