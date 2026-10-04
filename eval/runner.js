import { readFile } from "node:fs/promises";
import path from "node:path";
import { analyzeIntent } from "../core/intent/analyze.js";
import { buildConversationContext } from "../core/conversation/memory.js";
import { compilePrompt } from "../core/compiler/compile.js";

export async function runEvaluation(datasetPath = null) {
  const file = datasetPath || path.join(import.meta.dirname, "dataset.json");
  const data = JSON.parse(await readFile(file, "utf8"));

  const results = [];
  let passedCount = 0;

  for (const tc of data) {
    const failures = [];
    const intent = analyzeIntent(tc.request, tc.conversation);

    // Mock scan & retrieval for compiler evaluation
    const mockScan = {
      root: "/mock/project",
      languages: [{ name: "JavaScript", count: 10 }],
      frameworks: ["React"],
    };
    const mockRetrieval = {
      selected: intent.explicitFiles.map((p) => ({
        path: p,
        score: 0.95,
        matchReasons: ["explicitly referenced"],
        excerpt: "mock content",
      })),
    };
    const compiled = compilePrompt({
      intent,
      scan: mockScan,
      retrieval: mockRetrieval,
      git: { isRepository: true, branch: "main", modifiedFiles: [] },
    });

    const exp = tc.expected;

    if (exp.unresolvedAmbiguity !== undefined) {
      if (intent.ambiguity.unresolved !== exp.unresolvedAmbiguity) {
        failures.push(`Expected ambiguity.unresolved to be ${exp.unresolvedAmbiguity}, got ${intent.ambiguity.unresolved}`);
      }
    }

    if (exp.confidenceMax !== undefined) {
      if (intent.confidence > exp.confidenceMax) {
        failures.push(`Expected confidence <= ${exp.confidenceMax}, got ${intent.confidence}`);
      }
    }

    if (exp.targets) {
      for (const t of exp.targets) {
        if (!intent.targets.includes(t)) {
          failures.push(`Expected target token "${t}" to be detected`);
        }
      }
    }

    if (exp.mustPreserveConstraints) {
      for (const c of exp.mustPreserveConstraints) {
        const found = intent.constraints.some((actual) => actual.toLowerCase().includes(c.toLowerCase()));
        if (!found) {
          failures.push(`Constraint missing: "${c}"`);
        }
      }
    }

    if (exp.mustNotIncludeConstraint) {
      const found = intent.constraints.some((actual) => actual.toLowerCase().includes(exp.mustNotIncludeConstraint.toLowerCase()));
      if (found) {
        failures.push(`Constraint was supposed to be superseded but found: "${exp.mustNotIncludeConstraint}"`);
      }
    }

    if (exp.mustIncludeRequirement) {
      const found = intent.requirements.some((actual) => actual.toLowerCase().includes(exp.mustIncludeRequirement.toLowerCase()));
      if (!found) {
        failures.push(`Requirement missing: "${exp.mustIncludeRequirement}"`);
      }
    }

    const passed = failures.length === 0;
    if (passed) passedCount += 1;

    results.push({
      id: tc.id,
      name: tc.name,
      category: tc.category,
      passed,
      failures,
    });
  }

  const passRate = Math.round((passedCount / data.length) * 100);
  return {
    total: data.length,
    passed: passedCount,
    failed: data.length - passedCount,
    passRatePercent: passRate,
    results,
  };
}
