import {  Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { Auth0TokenProvider } from "../auth/Auth0TokenProvider.js";

export class MCPClient {

  constructor( tokenProvider  ) {
    this.client = new Client({ name: "next-agent", version: "1.0.0" });
    this.tokenProvider = tokenProvider || new Auth0TokenProvider();
  }

  /**
   * Establece la conexión con el servidor MCP utilizando un transporte HTTP que soporta streaming.
   * Este método obtiene un token de acceso del proveedor de tokens y lo utiliza para autenticar la conexión.
   * @returns {Promise<void>}
   */
  async connect() {

    const transport = new StreamableHTTPClientTransport(
      new URL(
        "https://sampling-mcp-production.up.railway.app/mcp",
      ),
      {
        fetch: async (url, init) => {
          const token = await this.tokenProvider.getAccessToken();

          const headers = new Headers(init?.headers);
          headers.set("Authorization", `Bearer ${token}`);

          return fetch(url, { ...init, headers });
        },
      },
    );

    await this.client.connect(transport);
    console.log('Connected successfully.');
  }

  /**
   * Lista todas las herramientas disponibles en el servidor MCP.
   * @returns {Promise<Array>} Una promesa que se resuelve con un array de herramientas.
   */
  async listTools() {
    return this.client.listTools();
  };

  /**
   * Llama a una herramienta específica en el servidor MCP.
   * @param {*} name 
   * @param {*} args 
   * @returns {Promise<any>} Una promesa que se resuelve con el resultado de la llamada a la herramienta.
   */
  async callTool(name, args) {
    return this.client.callTool({
      name,
      arguments: args || {},
    });
  };

  /**
   * Cierra la conexión con el servidor MCP.
   * @returns {Promise<void>}
   */
  async close() {
    await this.client.close();
  };
};
