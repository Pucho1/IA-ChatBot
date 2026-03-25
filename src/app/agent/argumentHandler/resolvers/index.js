import { DirectResolver } from "./DirectResolver";
import { HistoryResolver } from "./HistoryResolver";
import { FactsResolver } from "./FactsResolver";

export const createDefaultResolvers = () => {
  return [
    new DirectResolver(),
    new HistoryResolver(), // contexto inmediato (más fiable), despues vendria --> // fuente estructurada externa
    new FactsResolver(),   // memoria persistente
  ];
};
