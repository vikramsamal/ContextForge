import { estimateTokens } from "../token-stats.js";

export function optimizeContext({
  candidates = [],
  mode = "standard",
  maxFiles = 8,
  tokenBudget = null,
}) {
  const defaultBudget = mode === "fast" ? 3_000 : mode === "deep" ? 18_000 : 8_000;
  const budget = tokenBudget || defaultBudget;
  const limitCount = mode === "fast" ? Math.min(4, maxFiles) : mode === "deep" ? Math.max(12, maxFiles) : maxFiles;

  // Sort candidates by score descending
  const sorted = [...candidates].sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

  const required = [];
  const supporting = [];
  const optional = [];
  const excluded = [];

  let currentTokens = 0;

  for (const item of sorted) {
    const itemTokens = estimateTokens(`${item.path}\n${item.excerpt}`);

    if (item.score >= 0.6 || item.matchReasons.includes("explicitly referenced")) {
      if (required.length < limitCount && currentTokens + itemTokens <= budget) {
        required.push(item);
        currentTokens += itemTokens;
      } else {
        supporting.push(item);
      }
    } else if (item.score >= 0.25) {
      if (required.length + supporting.length < limitCount && currentTokens + itemTokens <= budget) {
        supporting.push(item);
        currentTokens += itemTokens;
      } else {
        optional.push(item);
      }
    } else if (item.score > 0.05) {
      optional.push(item);
    } else {
      excluded.push(item);
    }
  }

  const selected = [...required, ...supporting];

  return {
    required,
    supporting,
    optional,
    excluded,
    selected,
    totalTokens: currentTokens,
  };
}
