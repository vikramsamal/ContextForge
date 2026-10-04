export class OpenAICompatibleProvider {
  constructor(options = {}) {
    this.name = "openai";
    this.baseUrl = options.baseUrl || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || "";
    this.model = options.model || process.env.OPENAI_MODEL || "gpt-4o-mini";
  }

  async refinePrompt({ prompt, intent }) {
    if (!this.apiKey) {
      throw new Error("OpenAI provider requires an API key (OPENAI_API_KEY or config.apiKey).");
    }

    const url = `${this.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: "system",
            content: "You are ContextForge, a context-aware intent compiler for AI coding agents. Format and organize the implementation prompt accurately. Never hallucinate requirements or remove constraints.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || prompt;
    return {
      text,
      provider: "openai-compatible",
      model: this.model,
      tokensUsed: data.usage?.total_tokens || 0,
      privacy: `External endpoint: ${this.baseUrl}`,
    };
  }
}
