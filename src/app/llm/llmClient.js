import OpenAI from "openai";
import { debug } from "@/app/agent/debug/debug";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export function llmClient() {
  
  async function complete({ messages, temperature, format, tools }) {
    const config = {
      model: "gpt-4o-mini",
      temperature,
      messages,
    };

    if (format === "json_object") {
      config.response_format = { type: "json_object" };
      config.max_tokens = 500;
    }

    if (tools) {
      config.tools = tools;
      config.tool_choice = "auto";
      config.temperature = 0;
    }

    debug.log("[llmClient] completion config", config);
    return client.chat.completions.create(config);
  }

  async function Stream({ messages, temperature }) {
    debug.log("[llmClient] stream messages", messages);

    return client.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature,
      stream: true,
    });
  }

  return { complete, Stream };
}
