import { readFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CONFIG = Object.freeze({
  mode: "standard",
  maxFiles: 8,
  maxFileBytes: 256 * 1024,
  includeGit: true,
  includeTests: true,
  includeDocumentation: true,
});

export async function loadConfig(root, overrides = {}) {
  let fileConfig = {};
  for (const name of ["contextforge.config.json", ".contextforgerc.json"]) {
    try {
      fileConfig = JSON.parse(await readFile(path.join(root, name), "utf8"));
      break;
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw new Error(`Invalid ${name}: ${error.message}`);
      }
    }
  }

  const merged = { ...DEFAULT_CONFIG, ...fileConfig, ...clean(overrides) };
  if (!new Set(["fast", "standard", "deep"]).has(merged.mode)) {
    throw new Error(`Unknown mode "${merged.mode}". Use fast, standard, or deep.`);
  }
  merged.maxFiles = clamp(Number(merged.maxFiles), 1, 30);
  merged.maxFileBytes = clamp(Number(merged.maxFileBytes), 16 * 1024, 2 * 1024 * 1024);
  return merged;
}

function clean(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function clamp(value, min, max) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
}
