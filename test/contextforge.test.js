import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analyzeIntent, reduceConversation } from "../core/intent/analyze.js";
import { forgeContext } from "../core/contextforge.js";
import { scanProject } from "../project/scanner/scan.js";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "contextforge-test-"));
  await mkdir(path.join(root, "src", "auth"), { recursive: true });
  await mkdir(path.join(root, "tests"), { recursive: true });
  await writeFile(path.join(root, "package.json"), JSON.stringify({ dependencies: { react: "latest" } }));
  await writeFile(path.join(root, "README.md"), "# Demo\nAuthentication uses an existing session initializer.\n");
  await writeFile(path.join(root, "src", "auth", "session.js"), [
    "export async function initializeSession() {",
    "  return refreshToken();",
    "}",
    "export function refreshToken() {}",
  ].join("\n"));
  await writeFile(path.join(root, "src", "Login.jsx"), "export function Login() { return 'login'; }\n");
  await writeFile(path.join(root, "tests", "auth.test.js"), "test('restores session after refresh', () => {});\n");
  await writeFile(path.join(root, ".env"), "SECRET=never-read\n");
  return root;
}

test("extracts explicit constraints without judging grammar", () => {
  const result = analyzeIntent("login no work refresh fix but don't change UI");
  assert.equal(result.targets.includes("login"), true);
  assert.match(result.constraints.join(" "), /don't change UI/i);
  assert.equal(result.ambiguity.unresolved, false);
});

test("flags unresolved ambiguity instead of inventing a target", () => {
  const result = analyzeIntent("make it faster");
  assert.equal(result.ambiguity.unresolved, true);
  assert.ok(result.confidence < 0.6);
});

test("retains conversation requirements and constraints", () => {
  const state = reduceConversation([
    "Fix the upload.",
    "It also needs to support large files.",
    "Don't change the UI.",
    "Use the existing S3 implementation.",
  ]);
  assert.match(state.requirements.join(" "), /large files/i);
  assert.match(state.constraints.join(" "), /Don't change the UI/i);
  assert.match(state.constraints.join(" "), /existing S3/i);
});

test("latest explicit correction supersedes an obsolete constraint", () => {
  const state = reduceConversation([
    "Don't change the upload UI.",
    "Actually, redesign the upload UI to show progress.",
  ]);
  assert.doesNotMatch(state.constraints.join(" "), /don't change/i);
  assert.match(state.requirements.join(" "), /redesign the upload UI/i);
  assert.match(state.decisions.join(" "), /Latest correction/i);
});

test("scanner skips secret env files and detects project shape", async () => {
  const root = await fixture();
  const scan = await scanProject(root);
  assert.equal(scan.files.some((file) => file.path === ".env"), false);
  assert.equal(scan.frameworks.includes("React"), true);
  assert.equal(scan.languages.some((item) => item.name === "JavaScript"), true);
});

test("compiles grounded prompt with relevant files and statistics", async () => {
  const root = await fixture();
  const result = await forgeContext({
    root,
    request: "fix login after refresh but don't change UI",
    mode: "standard",
  });
  assert.match(result.prompt, /TASK\n/i);
  assert.match(result.prompt, /src\/auth\/session\.js/);
  assert.match(result.prompt, /CONSTRAINTS/);
  assert.match(result.prompt, /don't change UI/i);
  assert.equal(result.retrieval.selected[0].score > 0, true);
  assert.equal(result.stats.compiledPromptTokens > 0, true);
});

test("simple requests remain compact and select explicit files", async () => {
  const root = await fixture();
  const result = await forgeContext({ root, request: "Change src/Login.jsx button text to Submit", mode: "fast" });
  assert.equal(result.retrieval.selected.some((file) => file.path === "src/Login.jsx"), true);
  assert.ok(result.prompt.length < 4_000);
});
