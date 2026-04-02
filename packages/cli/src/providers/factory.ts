import type { AppConfig } from "@cc-timetravel/shared";
import type { LLMProvider } from "./interface.js";
import { OllamaProvider } from "./ollama.js";

export function createProvider(config: AppConfig["llm"]): LLMProvider {
  switch (config.provider) {
    case "ollama":
      return new OllamaProvider(config.ollamaUrl, config.embeddingModel, config.completionModel);
    default:
      return new OllamaProvider(config.ollamaUrl, config.embeddingModel, config.completionModel);
  }
}
