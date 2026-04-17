import { InputResolver }    from "./InputResolver";
import { HistoryResolver }  from "./HistoryResolver";
import { FactsResolver }    from "./FactsResolver";
import { LLMResolver }      from "./LLMResolver";
import { llmClient }        from "../../../llm/llmClinet";
import { ContextResolver }  from "./ContextResolver";

export const createDefaultResolvers = () => {
  return [
    new InputResolver(),   // contexto inmediato (más fiable), primera fuente a consultar para resolver argumentos
    new ContextResolver(), // contexto de referencia (muy útil para resolver referencias a corto plazo y mantener coherencia en la conversación)
    new HistoryResolver(), // contexto histórico (menos fiable pero útil para referencias a largo plazo)
    new FactsResolver(),   // memoria persistente
    new LLMResolver({ llmClient }),
  ];
};
