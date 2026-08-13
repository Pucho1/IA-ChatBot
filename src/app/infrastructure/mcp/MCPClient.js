import {
  Client,
//   type AuthProvider,
} from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { Auth0TokenProvider } from "../auth/Auth0TokenProvider.js";

export class MCPClient {

  constructor( tokenProvider  ) {
    this.client = new Client({ name: "next-agent", version: "1.0.0" });
    this.tokenProvider = tokenProvider || new Auth0TokenProvider();
  }

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


    await transport.close();
  }
}
