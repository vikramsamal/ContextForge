import assert from "node:assert/strict";
import test from "node:test";
import { detectAmbiguity } from "../core/ambiguity/detect.js";

test("detectAmbiguity flags vague requests without concrete targets", () => {
  const result = detectAmbiguity("make it faster");
  assert.equal(result.unresolved, true);
  assert.ok(result.confidence < 0.6);
  assert.ok(result.questions.length > 0);
});

test("detectAmbiguity resolves when explicit files are provided", () => {
  const result = detectAmbiguity("speed up login in src/auth/session.ts", null, ["src/auth/session.ts"], ["login"]);
  assert.equal(result.unresolved, false);
  assert.ok(result.confidence >= 0.9);
  assert.equal(result.questions.length, 0);
});
