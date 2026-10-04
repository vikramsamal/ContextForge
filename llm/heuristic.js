export class HeuristicLLMProvider {
  constructor(options = {}) {
    this.name = "heuristic";
    this.options = options;
  }

  async refinePrompt({ prompt, intent, context }) {
    // Deterministic local pass-through
    return {
      text: prompt,
      provider: "heuristic",
      model: "local-heuristic",
      tokensUsed: 0,
      privacy: "100% local, no network transmission",
    };
  }
}
