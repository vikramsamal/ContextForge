import { analyzeIntent } from "./intent/analyze.js";
import { compilePrompt } from "./compiler/compile.js";
import { loadConfig } from "./config.js";
import { contextStats } from "./token-stats.js";
import { retrieveContext } from "./retrieval/retrieve.js";
import { scanProject } from "../project/scanner/scan.js";
import { getGitContext } from "../project/git/context.js";

export async function forgeContext({ request, root = process.cwd(), conversation = [], ...overrides }) {
  const config = await loadConfig(root, overrides);
  const [scan, git] = await Promise.all([
    scanProject(root, config),
    config.includeGit ? getGitContext(root) : Promise.resolve({ isRepository: false, branch: null, modifiedFiles: [], recentCommits: [] }),
  ]);
  const intent = analyzeIntent(request, conversation, scan);
  const retrieval = await retrieveContext(scan, intent, config, git);
  const prompt = compilePrompt({ intent, scan, retrieval, git });
  const stats = contextStats({
    request: intent.request,
    retrievedText: retrieval.retrievedText,
    selectedText: retrieval.selectedText,
    compiledPrompt: prompt,
  });
  return { config, intent, scan, git, retrieval, prompt, stats };
}
