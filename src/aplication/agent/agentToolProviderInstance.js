import { AgentToolProvider } from "./agentToolProvider";
import { mcpClientManager } from "@/app/infrastructure/mcp/mcpManagerInstance";
import { cognitiveTools } from "@/app/agent/tools/cognitiveTools";

/**
 * Instancia singleton de AgentToolProvider para ser utilizada en toda la aplicación.
 * Se inicializa con el mcpClientManager y las herramientas cognitivas definidas en cognitiveTools.
 * Permite obtener el registro de herramientas del agente de manera centralizada y consistente.
 */
export const agentToolProvider = new AgentToolProvider({
  mcpClientManager,
  cognitiveTools,
});