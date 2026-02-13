import { Memory } from "./memory";


export function createMemoryStore(memoryStore, ip) {
    let  memory = memoryStore.get(ip); // obtengo la memoria asociada a esa IP, si es que existe

    if (!memory) {
        memory = {
          summary: [
            {
              role: "system",
              content: "",
            }
          ], // ----> esto aporta Contexto al chat
          facts: [], // ----> esto aporta Identidad al chat
          messages: [], // ----> esto aporta fluides al chat
          updatedAt: Date.now(),
        };
    
        memoryStore.set(ip, memory);
    };

    return new Memory(memory);
};