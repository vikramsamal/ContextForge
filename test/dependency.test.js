import assert from "node:assert/strict";
import test from "node:test";
import { extractDependenciesAndSymbols } from "../project/dependency/extractor.js";
import { DependencyGraph } from "../project/dependency/graph.js";

test("extractDependenciesAndSymbols extracts JS/TS imports and symbols", () => {
  const code = `
    import { fetchUser } from "./api.js";
    import React from "react";
    export async function loginUser(credentials) {}
    export class SessionManager {}
  `;
  const result = extractDependenciesAndSymbols("src/auth.js", code);
  assert.ok(result.imports.includes("./api.js"));
  assert.ok(result.symbols.includes("loginUser"));
  assert.ok(result.symbols.includes("SessionManager"));
});

test("DependencyGraph resolves relationships between files", () => {
  const graph = new DependencyGraph();
  graph.registerFile("src/auth/session.js", {
    imports: ["./token.js"],
    symbols: ["initializeSession"],
  });
  graph.registerFile("src/auth/token.js", {
    imports: [],
    symbols: ["refreshToken"],
  });
  graph.resolveDependencies([
    { path: "src/auth/session.js" },
    { path: "src/auth/token.js" },
  ]);

  const related = graph.getRelatedFiles("src/auth/session.js");
  assert.ok(related.directImports.includes("src/auth/token.js"));

  const tokenRelated = graph.getRelatedFiles("src/auth/token.js");
  assert.ok(tokenRelated.importedBy.includes("src/auth/session.js"));
});
