import { HeuristicLLMProvider } from "./heuristic.js";
import { OllamaProvider } from "./ollama.js";
import { OpenAICompatibleProvider } from "./openai.js";

export function getLLMProvider(config = {}) {
  const providerType = (config.llmProvider || process.env.CONTEXTFORGE_LLM_PROVIDER || "heuristic").toLowerCase();

  switch (providerType) {
    case "ollama":
      return new OllamaProvider(config.ollama || {});
    case "openai":
    case "openai-compatible":
      return new OpenAICompatibleProvider(config.openai || {});
    case "heuristic":
    default:
      return new HeuristicLLMProvider(config);
  }
}
