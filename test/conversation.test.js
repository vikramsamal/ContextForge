import assert from "node:assert/strict";
import test from "node:test";
import { ConversationMemory } from "../core/conversation/memory.js";
import { classifyMessage } from "../core/conversation/classifier.js";

test("classifyMessage categorizes different message intents", () => {
  assert.equal(classifyMessage("don't change the UI").category, "CONSTRAINT");
  assert.equal(classifyMessage("Actually, redesign the upload modal").category, "CORRECTION");
  assert.equal(classifyMessage("How does authentication work?").category, "QUESTION");
  assert.equal(classifyMessage("Let's not use S3 directly").category, "REJECTED_APPROACH");
  assert.equal(classifyMessage("Support large file uploads").category, "REQUIREMENT");
  assert.equal(classifyMessage("ok thanks").category, "IRRELEVANT");
});

test("ConversationMemory tracks state and handles superseding", () => {
  const memory = new ConversationMemory();
  memory.addTurn("user", "Fix file upload.");
  memory.addTurn("user", "Support files up to 2GB.");
  memory.addTurn("user", "Don't change the upload UI.");
  memory.addTurn("user", "Use existing S3 integration.");

  let snap = memory.getSnapshot();
  assert.equal(snap.originalGoal, "Fix file upload.");
  assert.ok(snap.requirements.some((r) => r.includes("2GB")));
  assert.ok(snap.constraints.some((c) => c.toLowerCase().includes("don't change the upload ui")));

  // User supersedes UI constraint
  memory.addTurn("user", "Actually, redesign the upload UI to show progress.");
  snap = memory.getSnapshot();

  // Old constraint removed
  assert.ok(!snap.constraints.some((c) => c.toLowerCase().includes("don't change the upload ui")));
  // New requirement added
  assert.ok(snap.requirements.some((r) => r.toLowerCase().includes("redesign the upload ui")));
  assert.equal(snap.superseded.length, 1);
});
