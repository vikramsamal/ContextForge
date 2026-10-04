export class OllamaProvider {
  constructor(options = {}) {
    this.name = "ollama";
    this.baseUrl = options.baseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    this.model = options.model || process.env.OLLAMA_MODEL || "llama3";
  }

  async refinePrompt({ prompt, intent }) {
    const url = `${this.baseUrl.replace(/\/$/, "")}/api/generate`;
    const body = {
      model: this.model,
      prompt: `You are ContextForge, an intent compiler for AI coding agents. Polish and format the following implementation prompt cleanly while strictly preserving all facts, constraints, and scope boundaries:\n\n${prompt}`,
      stream: false,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      text: data.response?.trim() || prompt,
      provider: "ollama",
      model: this.model,
      tokensUsed: data.eval_count || 0,
      privacy: `Local Ollama instance at ${this.baseUrl}`,
    };
  }
}
