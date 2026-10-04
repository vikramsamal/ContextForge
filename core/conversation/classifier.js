const CONSTRAINT_PATTERNS = [
  /(?:do not|don't|dont|avoid|without|must not|never)\s+([^.!?\n]+)/gi,
  /(?:keep|preserve|use|follow)\s+(?:the\s+)?(?:existing|current)\s+([^.!?\n]+)/gi,
  /(?:do not change|don't touch|leave as is|leave untouched|do not modify|don't modify)\s+([^.!?\n]+)/gi,
  /(?:no\s+(?:changes|modifications)\s+to)\s+([^.!?\n]+)/gi,
];

const CORRECTION_PATTERNS = [
  /\b(?:actually|instead|no longer|change that|scratch that|forget that|nevermind|ignore previous|on second thought)\b/i,
];

const REJECTED_PATTERNS = [
  /\b(?:let's not|lets not|don't want to use|avoid using|no to|reject|do not use|skip)\s+([^.!?\n]+)/gi,
];

const QUESTION_PATTERNS = [
  /\?$/,
  /^(?:how|why|where|when|what|is there|can we|should we|could we)\b/i,
];

const IMPLEMENTATION_PATTERNS = [
  /\b(?:using|with|via|implement via|in file|in)\s+([\w@.-]+(?:\/[\w@.() -]+)+\.[A-Za-z0-9]+|[\w@.-]+\.[A-Za-z0-9]{1,8})\b/gi,
  /\b(?:use the existing|integrate with|call)\s+([A-Za-z0-9_]+(?:\(\))?)/gi,
];

const ACKNOWLEDGEMENT_PATTERNS = [
  /^(?:(?:ok|okay|thanks|thank you|yes|no|yep|nope|sure|got it|sounds good|cool|great|proceed|continue)\s*)+[.!]?$/i,
];

export function classifyMessage(content) {
  const text = String(content || "").trim();
  if (!text) return { category: "IRRELEVANT", text: "", details: [] };

  if (ACKNOWLEDGEMENT_PATTERNS.some((p) => p.test(text))) {
    return { category: "IRRELEVANT", text, details: [] };
  }

  if (CORRECTION_PATTERNS.some((p) => p.test(text))) {
    return { category: "CORRECTION", text, details: [] };
  }

  if (QUESTION_PATTERNS.some((p) => p.test(text))) {
    return { category: "QUESTION", text, details: [] };
  }

  const rejectedMatches = extractMatches(text, REJECTED_PATTERNS);
  if (rejectedMatches.length) {
    return { category: "REJECTED_APPROACH", text, details: rejectedMatches };
  }

  const constraints = extractMatches(text, CONSTRAINT_PATTERNS);
  if (constraints.length) {
    return { category: "CONSTRAINT", text, details: constraints };
  }

  const implMatches = extractMatches(text, IMPLEMENTATION_PATTERNS);
  if (implMatches.length) {
    return { category: "IMPLEMENTATION_DETAIL", text, details: implMatches };
  }

  return { category: "REQUIREMENT", text, details: [] };
}

export function extractMatches(text, patterns) {
  const found = [];
  for (const pattern of patterns) {
    const globalPattern = pattern.global ? pattern : new RegExp(pattern.source, pattern.flags + "g");
    globalPattern.lastIndex = 0;
    for (const match of text.matchAll(globalPattern)) {
      const captured = match[0].trim();
      if (captured) found.push(sentence(captured));
    }
  }
  return [...new Set(found)];
}

export function sentence(value) {
  const clean = String(value || "").trim().replace(/\s+/g, " ");
  if (!clean) return "";
  return clean[0].toUpperCase() + clean.slice(1).replace(/[.!?]*$/, ".");
}
