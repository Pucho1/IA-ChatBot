import { resolveFact } from "./resolveFacts";

export function storeFact(memory, materializedFacts) {

  for ( const factCandidate of materializedFacts ) {

    const existing = memory.facts.find(fact => fact.key === factCandidate.key && fact.status === "active");

    const action = resolveFact(existing, factCandidate);

    switch (action.type) {
      case "CREATE":
        memory.facts.push(factCandidate);
        break;

      case "REPLACE":
        existing.value = factCandidate.value;
        existing.updatedAt = Date.now();
        break;

      case "APPEND":
        existing.value = existing.value + ";" + factCandidate.value;
        existing.updatedAt = Date.now();
        break;

      case "IGNORE":
      default:
        break;
    };

  };

};