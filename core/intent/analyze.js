import { classifyMessage, sentence, extractMatches } from "../conversation/classifier.js";
import { ConversationMemory } from "../conversation/memory.js";
import { detectAmbiguity } from "../ambiguity/detect.js";

const CONSTRAINT_PATTERNS = [
  /(?:do not|don't|dont|avoid|without|must not|never)\s+([^.!?\n]+)/gi,
  /(?:keep|preserve|use|follow)\s+(?:the\s+)?(?:existing|current)\s+([^.!?\n]+)/gi,
  /(?:do not change|don't touch|leave as is|leave untouched|do not modify|don't modify)\s+([^.!?\n]+)/gi,
  /(?:no\s+(?:changes|modifications)\s+to)\s+([^.!?\n]+)/gi,
];

const TARGET_WORDS = new Set([
  "login", "auth", "authentication", "dashboard", "upload", "export", "api",
  "database", "query", "test", "tests", "button", "form", "session", "cache",
  "performance", "startup", "build", "config", "configuration", "mcp", "cli",
  "download", "route", "routing", "middleware", "hook", "state", "store",
  "modal", "dialog", "drawer", "table", "card", "token", "jwt", "refresh",
  "multipart", "s3", "pagination", "search", "filter", "sort", "layout",
]);

export function analyzeIntent(request, conversation = [], projectScan = null) {
  const normalized = String(request || "").trim();
  if (!normalized) throw new Error("A request is required.");

  const memory = new ConversationMemory(conversation);
  const convSnapshot = memory.getSnapshot();

  const directConstraints = extractMatches(normalized, CONSTRAINT_PATTERNS);
  const constraints = unique([
    ...convSnapshot.constraints,
    ...directConstraints,
  ]);

  const explicitFiles = [
    ...normalized.matchAll(/(?:^|[\s`'"(])([\w@.-]+(?:\/[\w@.() -]+)+\.[A-Za-z0-9]+|[\w@.-]+\.[A-Za-z0-9]{1,8})(?=$|[\s`'"),])/g),
  ].map((match) => match[1]);

  const tokens = tokenize(normalized);
  const targets = unique(tokens.filter((token) => TARGET_WORDS.has(token)));

  const ambiguity = detectAmbiguity(normalized, projectScan, explicitFiles, targets);

  // Scope boundaries
  const scope = {
    allowed: deriveAllowedScope(normalized, targets, explicitFiles),
    prohibited: constraints,
  };

  return {
    request: normalized,
    objective: sentence(normalized),
    constraints,
    requirements: unique([...convSnapshot.requirements, sentence(normalized)]),
    decisions: convSnapshot.decisions,
    rejectedApproaches: convSnapshot.rejectedApproaches,
    implementationDetails: convSnapshot.implementationDetails,
    explicitFiles,
    targets,
    ambiguity,
    scope,
    confidence: ambiguity.confidence,
  };
}

export function reduceConversation(messages = []) {
  const memory = new ConversationMemory(messages);
  const snap = memory.getSnapshot();
  return {
    requirements: snap.requirements,
    constraints: snap.constraints,
    decisions: snap.decisions,
    rejectedApproaches: snap.rejectedApproaches,
    implementationDetails: snap.implementationDetails,
  };
}

export function tokenize(value) {
  return unique(String(value).toLowerCase().match(/[a-z][a-z0-9_-]{2,}/g) || [])
    .filter((token) => !STOP_WORDS.has(token));
}

function deriveAllowedScope(request, targets, explicitFiles) {
  const parts = [];
  if (explicitFiles.length) parts.push(`Files: ${explicitFiles.join(", ")}`);
  if (targets.length) parts.push(`Target domains: ${targets.join(", ")}`);
  if (!parts.length) parts.push("Target functionality implied by request");
  return parts.join("; ");
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

const STOP_WORDS = new Set([
  "the", "and", "for", "that", "this", "with", "from", "into", "but", "not",
  "dont", "don't", "please", "should", "would", "could", "have", "has", "after",
  "before", "when", "where", "what", "make", "change", "update", "fix", "issue",
  "some", "also", "just", "want", "like",
]);
