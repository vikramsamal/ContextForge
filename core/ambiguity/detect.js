import { tokenize } from "../intent/analyze.js";

const VAGUE_PATTERNS = [
  { pattern: /\b(?:make it|make this|make that)\s+(?:faster|quick|snappy|speed up)\b/i, category: "performance", question: "Which specific operation or view needs performance improvement (e.g., API response time, database query, frontend rendering, or initial build/startup)?" },
  { pattern: /\b(?:make it|make this)\s+(?:better|cleaner|nicer|modern)\b/i, category: "quality", question: "What specific aspect needs improvement (e.g., code structure, UI design, error handling, or test coverage)?" },
  { pattern: /\b(?:fix|handle)\s+(?:the\s+)?(?:issue|problem|bug|it|this|that|thing|stuff)\b/i, category: "target", question: "Which component or workflow is failing, and what is the expected error or behavior?" },
  { pattern: /\b(?:clean up|refactor|optimize)\s+(?:it|this|code|everything)\b/i, category: "scope", question: "Which specific modules, functions, or files are in scope for refactoring?" },
  { pattern: /\b(?:not working|broken|failing|crashed)\b/i, category: "symptom", question: "What error message or unexpected behavior occurs, and under what exact conditions?" },
];

export function detectAmbiguity(request, projectScan = null, explicitFiles = [], targetTokens = []) {
  const normalized = String(request || "").trim();
  const vagueMatches = [];

  for (const { pattern, category, question } of VAGUE_PATTERNS) {
    if (pattern.test(normalized)) {
      vagueMatches.push({ category, question });
    }
  }

  const hasExplicitTarget = explicitFiles.length > 0;
  const hasSpecificTokens = targetTokens.length > 0;
  const isDetailed = normalized.length > 80;

  // If request has explicit files and tokens, ambiguity is resolved by context
  if (hasExplicitTarget || (hasSpecificTokens && !vagueMatches.length) || (hasSpecificTokens && isDetailed)) {
    return {
      unresolved: false,
      confidence: hasExplicitTarget ? 0.95 : Math.min(0.9, 0.7 + targetTokens.length * 0.08),
      reason: null,
      questions: [],
      inferences: hasSpecificTokens ? [`Target domain identified: ${targetTokens.join(", ")}.`] : [],
      facts: explicitFiles.map((f) => `Target file explicitly referenced: ${f}`),
      unknowns: [],
    };
  }

  // If vague signals detected
  if (vagueMatches.length > 0 && !hasExplicitTarget && targetTokens.length <= 1) {
    const questions = vagueMatches.map((m) => m.question);

    // Check if project scan gives strong clues
    let projectEvidence = [];
    if (projectScan && projectScan.files) {
      if (vagueMatches.some((m) => m.category === "performance")) {
        const perfCandidates = projectScan.files.filter((f) => /(?:cache|db|database|query|api|dashboard|service)/i.test(f.path));
        if (perfCandidates.length > 0) {
          projectEvidence.push(`Found ${perfCandidates.length} potential performance-critical files in project.`);
        }
      }
    }

    return {
      unresolved: true,
      confidence: 0.45,
      reason: `The request "${normalized}" contains underspecified terms without sufficient target boundaries.`,
      questions,
      inferences: projectEvidence.length ? projectEvidence : [],
      facts: projectScan ? [`Scanned project has ${projectScan.files?.length || 0} indexed files.`] : [],
      unknowns: [
        "Exact subsystem or component targeted by the user.",
        "Expected observable success metric.",
      ],
    };
  }

  return {
    unresolved: false,
    confidence: isDetailed ? 0.85 : 0.75,
    reason: null,
    questions: [],
    inferences: targetTokens.length ? [`Inferred target focus: ${targetTokens.join(", ")}.`] : [],
    facts: [],
    unknowns: [],
  };
}
