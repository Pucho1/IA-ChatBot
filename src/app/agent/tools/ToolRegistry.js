// import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod"



const avaiblesTools = [
  { 
    name: "getCurrentDate",
    description: "Returns the current system date",
    // Aquí definimos el ESQUEMA (El contrato) de lo que esta herramienta espera como argumentos.
    //  En este caso, no esperamos ningún argumento, pero podríamos definir esquemas más complejos para herramientas que sí los requieran.
    schema:z.object({}), // No parameters needed for this tool
    handler: async () => new Date().toISOString()
  }, 

  {
    name: "searchFlights",
    description: "Search available flights for a given date and destination.",
    schema: z.object({
      date: z.string(),
      from: z.string(),
      to: z.string()
    }),
    handler: async ({ date, from, to }) => {
      console.log("Simulando búsqueda de vuelos...");
      return [
        {
          flightId: "IB123",
          airline: "Iberia",
          departure: `${date}T08:00:00`,
          arrival: `${date}T10:00:00`,
          price: 120
        },
        {
          flightId: "UX456",
          airline: "Air Europa",
          departure: `${date}T15:00:00`,
          arrival: `${date}T17:00:00`,
          price: 150
        }
      ];
    }
  },

  {
    name: "bookFlight",
    description: "Book a selected flight by its flightId.",
    schema: z.object({
      flightId: z.string(),
      passengerName: z.string()
    }),
    handler: async ({ flightId, passengerName }) => {
      console.log("Simulando reserva...");
      return {
        confirmationNumber: "CONF-" + Math.floor(Math.random() * 100000),
        flightId,
        passengerName,
        status: "confirmed"
      };
    }
  },

  {
    name: "generatePlan",
    description: "Generate a structured execution plan composed of ordered tool steps.",
    schema: z.object({
      steps: z.array(
        z.object({
          id: z.number(),
          description: z.string(),
          tool:  z.enum([
            "getCurrentDate",
            "searchFlights",
            "bookFlight"
          ]),
          // args: z.record(z.any()) esto teniendo un problema con la validación de los
          //  argumentos, porque cada herramienta tiene su propio esquema.
          args: z.object({}).passthrough(),

        }),
      ),
    }),
    handler: async ({ steps }) => {
      // No ejecuta nada.
      // Solo devuelve el plan estructurado.
      return { steps };
    }
  },

];

export class ToolRegistry {
  constructor() {
    this.tools = new Map();
  };

  /**
   * registra una herramienta en el registry
   * @param {*} name 
   * @param {*} handler 
   */
  registerTool(tool) {
    if(!tool) {
      avaiblesTools.forEach(tool => {
        this.#register(tool);
      })
    } else { this.#register(tool) };
  };

  #register(tool){

    if (!tool.name || !tool.handler || !tool.schema) {
      throw new Error(`Invalid tool definition: ${tool.name}`);
    };
   // Esto es crucial para evitar conflictos de nombres y asegurar que cada herramienta tenga un identificador único.
    // Si el LLM intenta registrar una herramienta que ya existe, esto nos ayudará a detectar ese error rápidamente.
    if (this.tools.has(tool.name)) { 
      throw new Error(`Tool "${tool.name}" ya registrada`);
    };
    this.tools.set(tool.name, tool);
  };

  /**
   * comprueba si la herramienta esta registrada
   * @param {*} name 
   * @returns boolean
   */
  has(name) {
    return this.tools.has(name);
  };

  get(name) {
    return this.tools.get(name);
  };

  list() {
    return Array.from(this.tools.keys());
  };

    /**
   * Devuelve las definiciones de las herramientas registradas, para que el LLM sepa como usarlas.
   * Una declaración formal de capacidades disponibles en este runtime.
   * @returns 
   */
  getToolManifest() {
    return Array.from(this.tools.values()).map(tool => {
      // const jsonSchema = zodToJsonSchema(tool.schema, {  target: "openApi3"}); 
      // problem de versiones con zod-to-json-schema, 
      // asi que lo hacemos a mano por ahora, pero la idea es usar esa librería para convertir los esquemas de 
      // zod a JSON Schema automáticamente, lo cual es crucial para que el LLM pueda entender claramente qué 
      // argumentos necesita pasar al usar esta herramienta.

      if (!tool.schema) {
        throw new Error(`Tool "${tool.name}" has no schema defined`);
      };

      const jsonSchema = tool.schema.toJSONSchema();
    
      // Eliminamos metadatos innecesarios para el LLM
      const { $schema, ...cleanSchema } = jsonSchema;

      return {
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: cleanSchema, // Schema limpio sin metadatos, para que el LLM pueda entender claramente qué argumentos necesita pasar al usar esta herramienta.
        },
      };
    });
  };

  /**
   * ejecuta la herramienta con los argumentos dados
   * @param {*} name
   * @param {*} args
   * @returns
   */
  async execute(name, args) {

    console.log(`Ejecutando herramienta "${name}" con argumentos:--------------`, args);



    const tool = this.tools.get(name);

    if (!tool) {
      throw new Error(`Tool "${name}" no registrada`);
    };

    const parsed = tool.schema.safeParse(args);

    if (!parsed.success) {
      throw new Error(parsed.error.message);
    };

    const result = await tool.handler(parsed.data);

    // Esto es un truco para asegurarnos de que el resultado es serializable, 
    // lo cual es crucial para que pueda ser enviado a través de la red o almacenado en la memoria del agente.
    return JSON.parse(JSON.stringify(result)); 
  };
};
