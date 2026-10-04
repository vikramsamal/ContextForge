import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { extractDependenciesAndSymbols } from "../dependency/extractor.js";
import { DependencyGraph } from "../dependency/graph.js";
import { ProjectIndexCache } from "../index/cache.js";

const DEFAULT_IGNORES = new Set([
  ".git", ".hg", ".svn", ".contextforge", ".contextforge-cache", "node_modules", "vendor", ".venv", "venv",
  "dist", "build", "coverage", ".next", ".nuxt", "target", "out", "__pycache__",
]);
const IMPORTANT = /^(?:readme(?:\..+)?|package\.json|pyproject\.toml|requirements[^/]*\.txt|cargo\.toml|go\.mod|dockerfile|compose\.ya?ml|tsconfig\.json|vite\.config\.[^.]+|next\.config\.[^.]+|makefile|justfile)$/i;
const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".gz", ".tar",
  ".woff", ".woff2", ".ttf", ".eot", ".mp3", ".mp4", ".mov", ".sqlite", ".db",
]);

export async function scanProject(root, options = {}) {
  const absoluteRoot = path.resolve(root);
  const maxFileBytes = options.maxFileBytes ?? 256 * 1024;
  const maxFiles = options.scanLimit ?? 20_000;
  const ignorePatterns = await readIgnorePatterns(absoluteRoot);
  const cache = new ProjectIndexCache(absoluteRoot);
  await cache.load();

  const files = [];
  const dependencyGraph = new DependencyGraph();
  let excluded = 0;
  let totalBytes = 0;

  async function walk(directory) {
    if (files.length >= maxFiles) return;
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(absoluteRoot, absolute).split(path.sep).join("/");
      if (shouldIgnore(relative, entry.name, ignorePatterns)) {
        excluded += 1;
        continue;
      }
      if (entry.isSymbolicLink()) {
        excluded += 1;
      } else if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile()) {
        const metadata = await stat(absolute);
        const extension = path.extname(entry.name).toLowerCase();
        const binary = BINARY_EXTENSIONS.has(extension);
        const tooLarge = metadata.size > maxFileBytes;
        const readable = !binary && !tooLarge;

        let symbols = [];
        let imports = [];

        if (readable && [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".py", ".go", ".rs"].includes(extension)) {
          if (cache.isFresh(relative, metadata.mtimeMs, metadata.size)) {
            const cached = cache.get(relative);
            symbols = cached.symbols || [];
            imports = cached.imports || [];
          } else {
            try {
              const text = await readFile(absolute, "utf8");
              if (!text.includes("\0")) {
                const extracted = extractDependenciesAndSymbols(relative, text.slice(0, 32_000));
                symbols = extracted.symbols;
                imports = extracted.imports;
                cache.set(relative, {
                  mtimeMs: metadata.mtimeMs,
                  size: metadata.size,
                  symbols,
                  imports,
                });
              }
            } catch {
              // Ignore unreadable file content
            }
          }
        }

        dependencyGraph.registerFile(relative, { imports, symbols });

        files.push({
          path: relative,
          absolutePath: absolute,
          size: metadata.size,
          modifiedMs: metadata.mtimeMs,
          extension,
          language: languageFor(extension, entry.name),
          important: IMPORTANT.test(entry.name),
          isTest: /(?:^|\/)(?:test|tests|__tests__)(?:\/|$)|(?:\.test|\.spec)\./i.test(relative),
          isDocumentation: /(?:^|\/)(?:docs?|documentation)(?:\/|$)|\.(?:md|mdx|rst)$/i.test(relative),
          readable,
          symbols,
          imports,
          excludedReason: binary ? "binary" : tooLarge ? "too-large" : null,
        });
        totalBytes += metadata.size;
      }
    }
  }

  await walk(absoluteRoot);
  dependencyGraph.resolveDependencies(files);

  // Save cache asynchronously
  cache.save().catch(() => {});

  return {
    root: absoluteRoot,
    files,
    excludedEntries: excluded,
    totalBytes,
    languages: summarizeLanguages(files),
    frameworks: await detectFrameworks(absoluteRoot, files),
    dependencyGraph,
    fingerprint: fingerprint(files),
  };
}

export async function readProjectFile(file, maxChars = 40_000) {
  if (!file.readable) return "";
  try {
    const content = await readFile(file.absolutePath, "utf8");
    if (content.includes("\0")) return "";
    return content.slice(0, maxChars);
  } catch {
    return "";
  }
}

function shouldIgnore(relative, name, patterns) {
  if (DEFAULT_IGNORES.has(name)) return true;
  if (name === ".env" || name.startsWith(".env.")) return true;
  return patterns.some((pattern) => {
    if (!pattern || pattern.startsWith("!")) return false;
    const clean = pattern.replace(/^\//, "").replace(/\/$/, "");
    if (!clean.includes("*")) return relative === clean || relative.startsWith(`${clean}/`) || name === clean;
    const regex = new RegExp(`^${clean.split("*").map(escapeRegex).join(".*")}(?:/.*)?$`);
    return regex.test(relative);
  });
}

async function readIgnorePatterns(root) {
  try {
    return (await readFile(path.join(root, ".gitignore"), "utf8"))
      .split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
  } catch {
    return [];
  }
}

function languageFor(extension, name) {
  return ({
    ".js": "JavaScript", ".mjs": "JavaScript", ".cjs": "JavaScript", ".ts": "TypeScript",
    ".tsx": "TypeScript", ".jsx": "JavaScript", ".py": "Python", ".go": "Go", ".rs": "Rust",
    ".java": "Java", ".kt": "Kotlin", ".swift": "Swift", ".rb": "Ruby", ".php": "PHP",
    ".cs": "C#", ".cpp": "C++", ".c": "C", ".h": "C/C++", ".sql": "SQL",
    ".md": "Markdown", ".json": "JSON", ".toml": "TOML", ".yaml": "YAML", ".yml": "YAML",
  })[extension] || (/^dockerfile$/i.test(name) ? "Dockerfile" : "Other");
}

function summarizeLanguages(files) {
  const counts = {};
  for (const file of files) counts[file.language] = (counts[file.language] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
}

async function detectFrameworks(root, files) {
  const found = [];
  if (files.some((file) => file.path === "package.json")) {
    try {
      const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      for (const [name, label] of Object.entries({ next: "Next.js", react: "React", vue: "Vue", svelte: "Svelte", express: "Express", fastify: "Fastify" })) {
        if (deps[name]) found.push(label);
      }
    } catch { /* malformed manifests are reported through context, not fatal */ }
  }
  if (files.some((file) => file.path === "pyproject.toml" || file.path.startsWith("requirements"))) found.push("Python");
  if (files.some((file) => file.path === "Cargo.toml")) found.push("Cargo");
  if (files.some((file) => file.path === "go.mod")) found.push("Go modules");
  return [...new Set(found)];
}

function fingerprint(files) {
  return createHash("sha256").update(files.map((file) => `${file.path}:${file.size}:${Math.trunc(file.modifiedMs)}`).join("\n")).digest("hex").slice(0, 16);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
