export function estimateTokens(text = "") {
  if (!text) return 0;
  return Math.ceil(Buffer.byteLength(text, "utf8") / 4);
}

export function contextStats({ request, retrievedText, selectedText, compiledPrompt }) {
  const retrieved = estimateTokens(retrievedText);
  const selected = estimateTokens(selectedText);
  return {
    originalRequestTokens: estimateTokens(request),
    retrievedContextTokens: retrieved,
    selectedContextTokens: selected,
    compiledPromptTokens: estimateTokens(compiledPrompt),
    estimatedContextReductionPercent: retrieved
      ? Math.max(0, Math.round((1 - selected / retrieved) * 100))
      : 0,
  };
}
