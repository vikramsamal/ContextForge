import { forgeContext } from "../core/contextforge.js";
import { loadConfig } from "../core/config.js";
import { scanProject } from "../project/scanner/scan.js";
import { getGitContext } from "../project/git/context.js";
import { analyzeIntent } from "../core/intent/analyze.js";
import { retrieveContext } from "../core/retrieval/retrieve.js";
import { buildConversationContext } from "../core/conversation/memory.js";
import { detectAmbiguity } from "../core/ambiguity/detect.js";
import { contextStats } from "../core/token-stats.js";

export const MCP_TOOLS = [
  {
    name: "contextforge.scan_project",
    description: "Perform a safe, read-only scan of the project to detect languages, frameworks, entry points, and file structure.",
    inputSchema: {
      type: "object",
      properties: {
        root: { type: "string", description: "Absolute or relative path to project root (default: cwd)" },
        mode: { type: "string", enum: ["fast", "standard", "deep"], description: "Scan depth mode" },
      },
    },
    handler: async (args) => {
      const root = args.root || process.cwd();
      const config = await loadConfig(root, { mode: args.mode });
      const scan = await scanProject(root, config);
      return {
        root: scan.root,
        totalFiles: scan.files.length,
        readableFiles: scan.files.filter((f) => f.readable).length,
        excludedEntries: scan.excludedEntries,
        sizeBytes: scan.totalBytes,
        languages: scan.languages,
        frameworks: scan.frameworks,
        fingerprint: scan.fingerprint,
      };
    },
  },
  {
    name: "contextforge.search_project",
    description: "Search project files and symbols ranked by relevance to a query or intent.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query or natural language target" },
        root: { type: "string", description: "Project root path" },
        mode: { type: "string", enum: ["fast", "standard", "deep"] },
        maxFiles: { type: "number", description: "Max results to return" },
      },
      required: ["query"],
    },
    handler: async (args) => {
      const root = args.root || process.cwd();
      const config = await loadConfig(root, { mode: args.mode, maxFiles: args.maxFiles });
      const [scan, git] = await Promise.all([scanProject(root, config), getGitContext(root)]);
      const intent = analyzeIntent(args.query, [], scan);
      const retrieval = await retrieveContext(scan, intent, config, git);
      return {
        query: args.query,
        results: retrieval.selected.map(({ path, score, matchReasons, excerpt }) => ({
          path,
          score,
          reasons: matchReasons,
          excerpt,
        })),
        totalMatching: retrieval.selected.length,
      };
    },
  },
  {
    name: "contextforge.get_project_context",
    description: "Get structured overview of project stack, repository status, and environment conventions.",
    inputSchema: {
      type: "object",
      properties: {
        root: { type: "string", description: "Project root path" },
      },
    },
    handler: async (args) => {
      const root = args.root || process.cwd();
      const config = await loadConfig(root);
      const [scan, git] = await Promise.all([scanProject(root, config), getGitContext(root)]);
      return {
        root: scan.root,
        languages: scan.languages,
        frameworks: scan.frameworks,
        git: {
          isRepository: git.isRepository,
          branch: git.branch,
          modifiedFilesCount: git.modifiedFiles?.length || 0,
          recentCommits: git.recentCommits?.slice(0, 3) || [],
        },
      };
    },
  },
  {
    name: "contextforge.get_relevant_files",
    description: "Retrieve prioritized files and contextual excerpts for a specific coding request.",
    inputSchema: {
      type: "object",
      properties: {
        request: { type: "string", description: "The user request or task description" },
        root: { type: "string", description: "Project root path" },
        mode: { type: "string", enum: ["fast", "standard", "deep"] },
      },
      required: ["request"],
    },
    handler: async (args) => {
      const root = args.root || process.cwd();
      const config = await loadConfig(root, { mode: args.mode });
      const [scan, git] = await Promise.all([scanProject(root, config), getGitContext(root)]);
      const intent = analyzeIntent(args.request, [], scan);
      const retrieval = await retrieveContext(scan, intent, config, git);
      return {
        selected: retrieval.selected.map((f) => ({
          path: f.path,
          score: f.score,
          reasons: f.matchReasons,
          excerpt: f.excerpt,
        })),
        supporting: retrieval.supporting.map((f) => ({ path: f.path, score: f.score })),
        excludedCount: retrieval.excludedCount,
      };
    },
  },
  {
    name: "contextforge.get_conversation_context",
    description: "Extract active requirements, constraints, decisions, and superseded instructions from a conversation history.",
    inputSchema: {
      type: "object",
      properties: {
        messages: {
          type: "array",
          items: {
            oneOf: [
              { type: "string" },
              {
                type: "object",
                properties: {
                  role: { type: "string" },
                  content: { type: "string" },
                },
                required: ["content"],
              },
            ],
          },
          description: "List of conversation turns",
        },
      },
      required: ["messages"],
    },
    handler: async (args) => {
      return buildConversationContext(args.messages);
    },
  },
  {
    name: "contextforge.analyze_intent",
    description: "Analyze raw human request to extract technical intent, explicit constraints, target domains, and scope boundaries.",
    inputSchema: {
      type: "object",
      properties: {
        request: { type: "string", description: "User request text" },
        conversation: { type: "array", description: "Optional prior conversation turns" },
        root: { type: "string", description: "Project root path" },
      },
      required: ["request"],
    },
    handler: async (args) => {
      const root = args.root || process.cwd();
      const config = await loadConfig(root);
      const scan = await scanProject(root, config);
      return analyzeIntent(args.request, args.conversation || [], scan);
    },
  },
  {
    name: "contextforge.detect_ambiguity",
    description: "Identify ambiguous or underspecified requests and generate clarifying questions.",
    inputSchema: {
      type: "object",
      properties: {
        request: { type: "string", description: "User request text" },
        root: { type: "string", description: "Project root path" },
      },
      required: ["request"],
    },
    handler: async (args) => {
      const root = args.root || process.cwd();
      const config = await loadConfig(root);
      const scan = await scanProject(root, config);
      const intent = analyzeIntent(args.request, [], scan);
      return intent.ambiguity;
    },
  },
  {
    name: "contextforge.compile_prompt",
    description: "Compile a complete, grounded, context-aware prompt for AI coding agents from a human request.",
    inputSchema: {
      type: "object",
      properties: {
        request: { type: "string", description: "User request" },
        root: { type: "string", description: "Project root directory" },
        mode: { type: "string", enum: ["fast", "standard", "deep"] },
        conversation: { type: "array", description: "Optional prior conversation messages" },
      },
      required: ["request"],
    },
    handler: async (args) => {
      const root = args.root || process.cwd();
      const result = await forgeContext({
        request: args.request,
        root,
        mode: args.mode,
        conversation: args.conversation || [],
      });
      return {
        prompt: result.prompt,
        intent: result.intent,
        stats: result.stats,
        selectedFiles: result.retrieval.selected.map((f) => ({
          path: f.path,
          score: f.score,
          reasons: f.matchReasons,
        })),
      };
    },
  },
  {
    name: "contextforge.validate_prompt",
    description: "Validate that a compiled prompt or proposed code change adheres to constraints and scope boundaries.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Compiled prompt to validate" },
        constraints: { type: "array", items: { type: "string" }, description: "List of active constraints" },
      },
      required: ["prompt"],
    },
    handler: async (args) => {
      const issues = [];
      const constraints = args.constraints || [];
      for (const c of constraints) {
        if (!args.prompt.toLowerCase().includes(c.toLowerCase().replace(/^[A-Za-z]+:\s*/, ""))) {
          issues.push(`Constraint missing from prompt: "${c}"`);
        }
      }
      return {
        valid: issues.length === 0,
        issues,
      };
    },
  },
  {
    name: "contextforge.get_context_stats",
    description: "Calculate token usage and reduction statistics for a request and compiled prompt.",
    inputSchema: {
      type: "object",
      properties: {
        request: { type: "string", description: "User request" },
        retrievedText: { type: "string", description: "Retrieved context" },
        selectedText: { type: "string", description: "Selected context" },
        compiledPrompt: { type: "string", description: "Compiled prompt" },
      },
      required: ["request", "compiledPrompt"],
    },
    handler: async (args) => {
      return contextStats({
        request: args.request,
        retrievedText: args.retrievedText || "",
        selectedText: args.selectedText || "",
        compiledPrompt: args.compiledPrompt,
      });
    },
  },
];
