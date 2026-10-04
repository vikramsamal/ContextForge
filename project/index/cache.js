import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

export class ProjectIndexCache {
  constructor(root, cacheDir = null) {
    this.root = path.resolve(root);
    this.cacheDir = cacheDir || path.join(this.root, ".contextforge-cache");
    this.cacheFile = path.join(this.cacheDir, "index.json");
    this.entries = new Map(); // relativePath -> { mtimeMs, size, hash, symbols, imports }
    this.loaded = false;
  }

  async load() {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.cacheFile, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed.root === this.root && parsed.entries) {
        for (const [k, v] of Object.entries(parsed.entries)) {
          this.entries.set(k, v);
        }
      }
    } catch {
      // Cache miss or doesn't exist yet, start fresh
    }
    this.loaded = true;
  }

  async save() {
    try {
      await mkdir(this.cacheDir, { recursive: true });
      const obj = {
        root: this.root,
        savedAt: Date.now(),
        entries: Object.fromEntries(this.entries.entries()),
      };
      await writeFile(this.cacheFile, JSON.stringify(obj, null, 2), "utf8");
    } catch {
      // Ignore cache write errors (e.g. read-only filesystem)
    }
  }

  isFresh(relativePath, mtimeMs, size) {
    const cached = this.entries.get(relativePath);
    if (!cached) return false;
    return cached.mtimeMs === mtimeMs && cached.size === size;
  }

  get(relativePath) {
    return this.entries.get(relativePath);
  }

  set(relativePath, data) {
    this.entries.set(relativePath, data);
  }

  computeHash(content) {
    return createHash("sha256").update(content).digest("hex").slice(0, 16);
  }
}
