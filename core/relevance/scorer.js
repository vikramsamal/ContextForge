import path from "node:path";
import { tokenize } from "../intent/analyze.js";

export function scoreFileRelevance({
  file,
  content = "",
  requestTokens = [],
  explicitFiles = new Set(),
  modifiedFiles = new Set(),
  dependencyGraph = null,
  candidateSymbols = new Set(),
  mode = "standard",
}) {
  const normalizedPath = file.path.split(path.sep).join("/");
  const baseName = path.basename(file.path);
  const ext = path.extname(file.path).toLowerCase();

  const isExplicit = explicitFiles.has(normalizedPath.toLowerCase()) || explicitFiles.has(baseName.toLowerCase());
  const pathTokens = tokenize(file.path);
  const pathMatches = countOverlap(requestTokens, pathTokens);

  // Content matching
  const lowered = content.toLowerCase();
  const matchedTokens = requestTokens.filter((token) => lowered.includes(token));
  const contentMatches = matchedTokens.length;
  const density = requestTokens.length ? contentMatches / requestTokens.length : 0;

  // Symbol matching
  let matchedSymbols = [];
  if (candidateSymbols.size > 0 && dependencyGraph) {
    const fileData = dependencyGraph.fileData.get(normalizedPath);
    if (fileData?.symbols) {
      matchedSymbols = fileData.symbols.filter((sym) => candidateSymbols.has(sym.toLowerCase()) || requestTokens.includes(sym.toLowerCase()));
    }
  }

  // Dependency relationships
  let depMatch = false;
  if (dependencyGraph) {
    const { directImports, importedBy } = dependencyGraph.getRelatedFiles(normalizedPath);
    const relatedExplicit = [...directImports, ...importedBy].some((p) => explicitFiles.has(p.toLowerCase()) || explicitFiles.has(path.basename(p).toLowerCase()));
    if (relatedExplicit) depMatch = true;
  }

  // Test relationship
  const isTest = file.isTest;
  const testMatch = isTest && (contentMatches > 0 || pathMatches > 0);

  // Git modification
  const isModified = modifiedFiles.has(file.path);

  // Calculate composite score
  let score = 0;
  if (isExplicit) score += 0.55;
  score += Math.min(0.25, pathMatches * 0.1);
  score += Math.min(0.30, density * 0.35);
  if (matchedSymbols.length > 0) score += Math.min(0.20, matchedSymbols.length * 0.1);
  if (depMatch) score += 0.15;
  if (isModified) score += 0.10;
  if (testMatch) score += 0.10;
  if (file.important) score += 0.05;
  if (baseName.toLowerCase().startsWith("readme")) score += 0.04;

  const reasons = [];
  if (isExplicit) reasons.push("explicitly referenced");
  if (pathMatches > 0) reasons.push("path matches request");
  if (contentMatches > 0) reasons.push(`${contentMatches} content keyword${contentMatches === 1 ? "" : "s"}`);
  if (matchedSymbols.length > 0) reasons.push(`defines symbol${matchedSymbols.length === 1 ? "" : "s"} (${matchedSymbols.slice(0, 3).join(", ")})`);
  if (depMatch) reasons.push("imports/imported by target file");
  if (isModified) reasons.push("currently modified in Git");
  if (testMatch) reasons.push("related test for target area");
  if (file.important) reasons.push("project metadata / manifest");

  return {
    score: Math.min(1, Number(score.toFixed(3))),
    reasons,
  };
}

function countOverlap(a, b) {
  const setB = new Set(b);
  return a.filter((item) => setB.has(item)).length;
}
