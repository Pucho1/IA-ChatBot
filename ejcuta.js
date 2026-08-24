import { MCPClientManager } from "./src/app/infrastructure/mcp/MCPClientManager.js";
import { Auth0TokenProvider } from "./src/app/infrastructure/auth/Auth0TokenProvider.js";

// const provider = new Auth0TokenProvider();

// const token = await provider.getAccessToken();

// console.log(token);



const manager = new MCPClientManager(new Auth0TokenProvider());

const tools1 = await manager.getTools();
const tools2 = await manager.getTools();

console.log(
  "Tools 1:",tools1.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  })),
  "Tools 2:",tools2.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  })),
  // tools1.map((tool) => ({
  //   name: tool.name,
  //   description: tool.description,
  //   inputSchema: tool.inputSchema,
  // })),
);
