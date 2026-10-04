export function compilePrompt({ intent, scan, retrieval, git }) {
  const sections = [];
  const isSimpleTask = intent.explicitFiles.length > 0 && intent.constraints.length === 0 && !intent.ambiguity.unresolved && retrieval.selected.length <= 2;

  // 1. TASK
  sections.push(section("TASK", intent.objective));

  // 2. USER INTENT
  const userIntentLines = [];
  if (intent.requirements.length > 1) {
    userIntentLines.push(`Retained conversation requirements:\n${bullets(intent.requirements)}`);
  }
  userIntentLines.push(`Interpret the request by technical intent, not by grammar. Confidence: ${Math.round(intent.confidence * 100)}%.`);
  sections.push(section("USER INTENT", userIntentLines.join("\n\n")));

  // 3. PROJECT CONTEXT
  const projectFacts = [
    `FACT: Project root: ${scan.root}`,
    scan.languages.length ? `FACT: Detected languages: ${scan.languages.slice(0, 5).map((item) => `${item.name} (${item.count})`).join(", ")}.` : null,
    scan.frameworks.length ? `FACT: Detected project technologies: ${scan.frameworks.join(", ")}.` : null,
    git?.isRepository ? `FACT: Git branch: ${git.branch}${git.modifiedFiles?.length ? ` (${git.modifiedFiles.length} uncommitted file(s))` : ""}.` : "FACT: No Git repository was detected.",
  ].filter(Boolean);
  sections.push(section("PROJECT CONTEXT", projectFacts.join("\n")));

  // 4. RELEVANT FILES
  if (retrieval.selected.length) {
    sections.push(section("RELEVANT FILES", retrieval.selected.map((file) => {
      const why = file.matchReasons.length ? file.matchReasons.join(", ") : "project context";
      return `- ${file.path} — relevance ${file.score.toFixed(2)}; ${why}.`;
    }).join("\n")));
  }

  // 5. CURRENT BEHAVIOR / RELEVANT OBSERVATIONS
  const currentBehavior = [];
  if (retrieval.selected.some((f) => f.path.includes("auth") || f.path.includes("session"))) {
    currentBehavior.push("Authentication / session initialization flows detected in relevant files.");
  }
  if (git?.modifiedFiles?.length) {
    currentBehavior.push(`Working tree has uncommitted modifications in: ${git.modifiedFiles.slice(0, 4).map((f) => f.path).join(", ")}.`);
  }
  if (currentBehavior.length) {
    sections.push(section("CURRENT BEHAVIOR", bullets(currentBehavior)));
  }

  // 6. EXPECTED BEHAVIOR
  sections.push(section("EXPECTED BEHAVIOR", `- Fulfill the stated objective: "${intent.objective}" while strictly satisfying all constraints.`));

  // 7. CONSTRAINTS & SCOPE BOUNDARIES
  const constraintList = [...intent.constraints];
  constraintList.push("Make the smallest safe change and do not modify unrelated functionality.");
  if (intent.scope?.prohibited?.length) {
    for (const p of intent.scope.prohibited) {
      if (!constraintList.includes(p)) constraintList.push(p);
    }
  }

  const scopeBoundaryLines = [];
  if (intent.scope?.allowed) {
    scopeBoundaryLines.push(`- Allowed scope: ${intent.scope.allowed}.`);
  }
  scopeBoundaryLines.push(...constraintList.map((c) => `- Prohibited: ${c}`));

  sections.push(section("CONSTRAINTS & SCOPE", scopeBoundaryLines.join("\n")));

  // 8. DECISIONS
  if (intent.decisions?.length) {
    sections.push(section("DECISIONS & HISTORY", bullets(intent.decisions)));
  }

  // 9. IMPORTANT EXISTING PATTERNS
  const patterns = [];
  if (scan.frameworks.length) {
    patterns.push(`Follow standard idioms and existing patterns used in the ${scan.frameworks.join(" / ")} codebase.`);
  }
  patterns.push("Prefer using existing utilities, types, and configurations already present in the project.");
  sections.push(section("IMPORTANT EXISTING PATTERNS", bullets(patterns)));

  // 10. AMBIGUITIES (Only if unresolved)
  if (intent.ambiguity.unresolved) {
    sections.push(section("AMBIGUITIES", [
      `UNKNOWN: ${intent.ambiguity.reason}`,
      ...intent.ambiguity.questions.map((question) => `- ${question}`),
      "Do not invent the missing requirement. Clarify with the user before executing changes.",
    ].join("\n")));
  }

  // 11. IMPLEMENTATION GUIDANCE
  sections.push(section("IMPLEMENTATION GUIDANCE", [
    "Inspect the selected implementation before editing and confirm suspected behavior directly from code.",
    "Distinguish verified FACTS from INFERENCES and UNKNOWNS.",
    "Follow existing patterns rather than introducing parallel architecture.",
  ].join("\n")));

  // 12. VALIDATION
  sections.push(section("VALIDATION", bullets([
    "Run the narrowest relevant tests, type checks, or linting checks available in the project.",
    "Verify the requested behavior and verify that all preserved behaviors in the constraints remain intact.",
    "Report what was actually run; never claim unexecuted checks passed.",
  ])));

  // 13. SUCCESS CRITERIA
  sections.push(section("SUCCESS CRITERIA", bullets([
    "The requested objective is observably implemented or resolved.",
    "Explicit constraints and existing behavior are preserved.",
    "No unrelated files, contracts, or dependencies are modified.",
  ])));

  return sections.filter(Boolean).join("\n\n");
}

function section(title, content) {
  return content ? `${title}\n${content}` : "";
}

function bullets(items) {
  return items.map((item) => `- ${String(item).replace(/[.!?]*$/, ".")}`).join("\n");
}
