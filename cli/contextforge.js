#!/usr/bin/env node
import process from "node:process";
import { forgeContext } from "../core/contextforge.js";
import { loadConfig } from "../core/config.js";
import { scanProject } from "../project/scanner/scan.js";
import { getGitContext } from "../project/git/context.js";
import { analyzeIntent } from "../core/intent/analyze.js";
import { retrieveContext } from "../core/retrieval/retrieve.js";
import { runMcpServer } from "../mcp/server.js";
import { runEvaluation } from "../eval/runner.js";

const VERSION = "0.2.0";

main().catch((error) => {
  console.error(`ContextForge: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help || parsed.command === "help") return printHelp();
  if (parsed.version) return console.log(VERSION);

  const root = parsed.root || process.cwd();
  const overrides = { mode: parsed.mode, maxFiles: parsed.maxFiles };

  if (parsed.command === "mcp") {
    return runMcpServer();
  }

  if (parsed.command === "eval") {
    const report = await runEvaluation();
    if (parsed.json) return print(report, true);
    console.log(`\nContextForge Golden Dataset Evaluation`);
    console.log(`Pass Rate: ${report.passRatePercent}% (${report.passed}/${report.total} test cases passed)\n`);
    for (const r of report.results) {
      const icon = r.passed ? "✔" : "✖";
      console.log(`${icon} [${r.category}] ${r.name}`);
      if (!r.passed) {
        for (const f of r.failures) console.log(`    - ${f}`);
      }
    }
    if (report.failed > 0) process.exitCode = 1;
    return;
  }

  if (parsed.command === "scan" || parsed.command === "status") {
    const config = await loadConfig(root, overrides);
    const [scan, git] = await Promise.all([scanProject(root, config), getGitContext(root)]);
    const output = {
      root: scan.root,
      files: scan.files.length,
      readableFiles: scan.files.filter((file) => file.readable).length,
      excludedEntries: scan.excludedEntries,
      sizeBytes: scan.totalBytes,
      languages: scan.languages,
      frameworks: scan.frameworks,
      fingerprint: scan.fingerprint,
      git,
    };
    return print(output, parsed.json);
  }

  if (parsed.command === "search") {
    const query = parsed.positionals.join(" ").trim();
    if (!query) throw new Error("search requires a query");
    const config = await loadConfig(root, overrides);
    const [scan, git] = await Promise.all([scanProject(root, config), getGitContext(root)]);
    const intent = analyzeIntent(query, [], scan);
    const retrieval = await retrieveContext(scan, intent, config, git);
    return print(retrieval.selected.map(({ path, score, matchReasons }) => ({ path, score, reasons: matchReasons })), parsed.json);
  }

  if (!["compile", "explain", "stats"].includes(parsed.command)) {
    throw new Error(`Unknown command "${parsed.command}". Run contextforge --help.`);
  }

  const request = parsed.positionals.join(" ").trim();
  if (!request) throw new Error(`${parsed.command} requires a request`);
  const conversation = await readConversation(parsed.conversation);
  const result = await forgeContext({ request, root, conversation, ...overrides });

  if (parsed.command === "compile") {
    if (parsed.json) return print(serializableResult(result), true);
    console.log(result.prompt);
    console.log("\nCONTEXT STATS");
    console.log(formatStats(result.stats));
    return;
  }

  if (parsed.command === "stats") return print(result.stats, parsed.json);

  return print({
    intent: result.intent,
    project: {
      root: result.scan.root,
      languages: result.scan.languages,
      frameworks: result.scan.frameworks,
      git: result.git,
    },
    context: {
      selected: result.retrieval.selected.map(({ path, score, matchReasons }) => ({ path, score, reasons: matchReasons })),
      supporting: result.retrieval.supporting.map(({ path, score }) => ({ path, score })),
      excludedFiles: result.retrieval.excludedCount,
    },
    stats: result.stats,
  }, parsed.json);
}

function parseArgs(args) {
  const output = { command: "compile", positionals: [] };
  const knownCommands = new Set(["compile", "scan", "status", "search", "explain", "stats", "mcp", "eval", "help"]);
  if (args[0] && knownCommands.has(args[0])) output.command = args.shift();
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--help" || value === "-h") output.help = true;
    else if (value === "--version" || value === "-v") output.version = true;
    else if (value === "--json") output.json = true;
    else if (value === "--root") output.root = requireValue(args, ++index, "--root");
    else if (value === "--mode") output.mode = requireValue(args, ++index, "--mode").toLowerCase();
    else if (value === "--max-files") output.maxFiles = Number(requireValue(args, ++index, "--max-files"));
    else if (value === "--conversation") output.conversation = requireValue(args, ++index, "--conversation");
    else if (value.startsWith("-")) throw new Error(`Unknown option "${value}"`);
    else output.positionals.push(value);
  }
  return output;
}

function requireValue(args, index, flag) {
  if (!args[index]) throw new Error(`${flag} requires a value`);
  return args[index];
}

async function readConversation(filename) {
  if (!filename) return [];
  const { readFile } = await import("node:fs/promises");
  const value = JSON.parse(await readFile(filename, "utf8"));
  if (!Array.isArray(value)) throw new Error("Conversation file must contain a JSON array.");
  return value;
}

function serializableResult(result) {
  return {
    prompt: result.prompt,
    intent: result.intent,
    selectedFiles: result.retrieval.selected.map(({ path, score, matchReasons, excerpt }) => ({ path, score, matchReasons, excerpt })),
    stats: result.stats,
  };
}

function print(value, json) {
  if (json) return console.log(JSON.stringify(value, null, 2));
  if (Array.isArray(value)) {
    if (!value.length) return console.log("No matching files found.");
    for (const item of value) console.log(`${item.score.toFixed(2)}  ${item.path}  ${item.reasons?.join(", ") || ""}`.trimEnd());
    return;
  }
  console.log(JSON.stringify(value, null, 2));
}

function formatStats(stats) {
  return [
    `Original request: ${stats.originalRequestTokens} tokens`,
    `Retrieved context: ${stats.retrievedContextTokens} tokens`,
    `Selected context: ${stats.selectedContextTokens} tokens`,
    `Compiled prompt: ${stats.compiledPromptTokens} tokens`,
    `Estimated context reduction: ${stats.estimatedContextReductionPercent}%`,
  ].join("\n");
}

function printHelp() {
  console.log(`ContextForge ${VERSION} — local-first intent compiler for AI coding agents

Usage:
  contextforge "fix login after refresh but don't change the UI"
  contextforge compile <request> [options]
  contextforge scan [options]
  contextforge status [options]
  contextforge search <query> [options]
  contextforge explain <request> [options]
  contextforge stats <request> [options]
  contextforge mcp
  contextforge eval

Options:
  --root <path>             Project to inspect (default: current directory)
  --mode <fast|standard|deep> Context retrieval mode (default: standard)
  --max-files <number>      Maximum selected files
  --conversation <file>     JSON array of earlier messages
  --json                    Structured machine-readable output
  -h, --help                Show help
  -v, --version             Show version`);
}
