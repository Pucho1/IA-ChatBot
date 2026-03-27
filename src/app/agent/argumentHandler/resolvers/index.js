import { InputResolver } from "./InputResolver";
import { HistoryResolver } from "./HistoryResolver";
import { FactsResolver } from "./FactsResolver";
import { LLMResolver } from "./LLMResolver";
import { llmClient } from "../../../llm/llmClinet";

export const createDefaultResolvers = () => {
  return [
    new InputResolver(),
    new HistoryResolver(), // contexto inmediato (más fiable), despues vendria --> // fuente estructurada externa
    new FactsResolver(),   // memoria persistente
    new LLMResolver({ llmClient }),
  ];
};
