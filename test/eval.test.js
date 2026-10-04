import assert from "node:assert/strict";
import test from "node:test";
import { runEvaluation } from "../eval/runner.js";

test("Golden dataset evaluation achieves 100% pass rate", async () => {
  const report = await runEvaluation();
  assert.ok(report.total >= 8);
  assert.equal(report.failed, 0, `Expected 0 failures, got: ${JSON.stringify(report.results.filter((r) => !r.passed))}`);
  assert.equal(report.passRatePercent, 100);
});
