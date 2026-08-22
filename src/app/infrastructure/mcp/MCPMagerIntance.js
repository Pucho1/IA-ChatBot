import { Auth0TokenProvider }   from "../auth/Auth0TokenProvider.js";
import { MCPClientManager }     from "./MCPClientManager.js";

const tokenProvider = new Auth0TokenProvider();

export const mcpClientManager =  new MCPClientManager(tokenProvider);