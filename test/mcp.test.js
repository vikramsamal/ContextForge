import assert from "node:assert/strict";
import test from "node:test";
import { MCP_TOOLS } from "../mcp/tools.js";

test("MCP_TOOLS provides all 10 standard tools", () => {
  const toolNames = MCP_TOOLS.map((t) => t.name);
  assert.equal(toolNames.length, 10);
  assert.ok(toolNames.includes("contextforge.scan_project"));
  assert.ok(toolNames.includes("contextforge.search_project"));
  assert.ok(toolNames.includes("contextforge.get_project_context"));
  assert.ok(toolNames.includes("contextforge.get_relevant_files"));
  assert.ok(toolNames.includes("contextforge.get_conversation_context"));
  assert.ok(toolNames.includes("contextforge.analyze_intent"));
  assert.ok(toolNames.includes("contextforge.detect_ambiguity"));
  assert.ok(toolNames.includes("contextforge.compile_prompt"));
  assert.ok(toolNames.includes("contextforge.validate_prompt"));
  assert.ok(toolNames.includes("contextforge.get_context_stats"));
});

test("MCP tool contextforge.analyze_intent runs successfully", async () => {
  const tool = MCP_TOOLS.find((t) => t.name === "contextforge.analyze_intent");
  assert.ok(tool);
  const result = await tool.handler({ request: "fix login after refresh but don't change UI" });
  assert.equal(result.targets.includes("login"), true);
  assert.ok(result.constraints.length > 0);
});
