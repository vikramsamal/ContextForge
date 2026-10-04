import path from "node:path";
import { tokenize } from "../intent/analyze.js";
import { readProjectFile } from "../../project/scanner/scan.js";
import { scoreFileRelevance } from "../relevance/scorer.js";
import { optimizeContext } from "../optimization/optimize.js";

export async function retrieveContext(scan, intent, config, gitContext) {
  const mode = config.mode || "standard";
  const requestTokens = expandTokens(tokenize(`${intent.request} ${intent.requirements.join(" ")}`));
  const explicitFiles = new Set(intent.explicitFiles.map((item) => item.toLowerCase()));
  const modifiedFiles = new Set((gitContext?.modifiedFiles || []).map((item) => item.path));
  const candidateSymbols = new Set(intent.targets);

  const candidates = [];
  const retrievedParts = [];
  const contentLimit = mode === "fast" ? 8_000 : mode === "deep" ? 50_000 : 24_000;

  for (const file of scan.files) {
    if (!file.readable) continue;
    if (!config.includeTests && file.isTest) continue;
    if (!config.includeDocumentation && file.isDocumentation) continue;

    let content = "";
    const pathTokens = tokenize(file.path);
    const pathMatches = countOverlap(requestTokens, pathTokens);
    const explicitMatch = explicitFiles.has(file.path.toLowerCase()) || explicitFiles.has(path.basename(file.path).toLowerCase());
    const likely = explicitMatch || pathMatches > 0 || file.important || (mode === "deep" && file.size < 64_000);

    if (likely) {
      content = await readProjectFile(file, contentLimit);
      if (content) retrievedParts.push(content);
    }

    const { score, reasons } = scoreFileRelevance({
      file,
      content,
      requestTokens,
      explicitFiles,
      modifiedFiles,
      dependencyGraph: scan.dependencyGraph,
      candidateSymbols,
      mode,
    });

    if (score > 0.035 || explicitMatch) {
      candidates.push({
        ...file,
        score,
        matchReasons: reasons,
        excerpt: makeExcerpt(content, requestTokens, candidateSymbols),
      });
    }
  }

  const optimized = optimizeContext({
    candidates,
    mode,
    maxFiles: config.maxFiles,
  });

  return {
    selected: optimized.selected,
    required: optimized.required,
    supporting: optimized.supporting,
    optional: optimized.optional,
    excludedCount: Math.max(0, scan.files.length - optimized.selected.length),
    retrievedText: retrievedParts.join("\n"),
    selectedText: optimized.selected.map((file) => `${file.path}\n${file.excerpt}`).join("\n"),
  };
}

function countOverlap(a, b) {
  const lookup = new Set(b);
  return a.filter((item) => lookup.has(item)).length;
}

function expandTokens(tokens) {
  const groups = [
    ["login", "auth", "authentication", "session", "token", "jwt", "cookie"],
    ["upload", "file", "multipart", "storage", "s3", "blob"],
    ["dashboard", "card", "widget", "panel", "chart", "metrics"],
    ["refresh", "restore", "initialize", "initialise", "hydrate", "reload"],
    ["fast", "faster", "performance", "latency", "cache", "slow", "speed", "optimization"],
    ["export", "download", "csv", "pdf", "report"],
    ["api", "endpoint", "route", "handler", "service", "controller"],
    ["database", "db", "query", "sql", "postgres", "sqlite", "prisma", "orm"],
  ];
  const output = new Set(tokens);
  for (const group of groups) {
    if (group.some((term) => output.has(term))) {
      group.forEach((term) => output.add(term));
    }
  }
  return [...output];
}

function makeExcerpt(content, tokens, symbols = new Set()) {
  if (!content) return "";
  const lines = content.split("\n");
  const matching = [];

  for (let index = 0; index < lines.length; index += 1) {
    const lowered = lines[index].toLowerCase();
    const tokenHit = tokens.some((token) => lowered.includes(token));
    const symbolHit = Array.from(symbols).some((sym) => lowered.includes(sym.toLowerCase()));

    if (tokenHit || symbolHit) {
      for (let cursor = Math.max(0, index - 1); cursor <= Math.min(lines.length - 1, index + 2); cursor += 1) {
        matching.push(cursor);
      }
    }
  }

  const chosen = [...new Set(matching)].slice(0, 18);
  return chosen.length
    ? chosen.map((index) => `${index + 1}: ${lines[index]}`).join("\n")
    : lines.slice(0, 8).join("\n");
}
