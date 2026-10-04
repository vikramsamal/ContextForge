import path from "node:path";

export class DependencyGraph {
  constructor() {
    this.fileData = new Map(); // filePath -> { imports, symbols }
    this.importGraph = new Map(); // filePath -> Set of imported filePaths
    this.reverseImportGraph = new Map(); // filePath -> Set of files that import this file
    this.symbolToFile = new Map(); // symbol -> Set of filePaths
  }

  registerFile(filePath, { imports = [], symbols = [] }) {
    const normalized = filePath.split(path.sep).join("/");
    this.fileData.set(normalized, { imports, symbols });

    if (!this.importGraph.has(normalized)) {
      this.importGraph.set(normalized, new Set());
    }
    if (!this.reverseImportGraph.has(normalized)) {
      this.reverseImportGraph.set(normalized, new Set());
    }

    for (const sym of symbols) {
      if (!this.symbolToFile.has(sym)) {
        this.symbolToFile.set(sym, new Set());
      }
      this.symbolToFile.get(sym).add(normalized);
    }
  }

  resolveDependencies(allFiles = []) {
    const fileLookup = new Map();
    for (const f of allFiles) {
      const p = f.path.split(path.sep).join("/");
      fileLookup.set(p, p);
      const withoutExt = p.replace(/\.[^/.]+$/, "");
      fileLookup.set(withoutExt, p);
      fileLookup.set(path.basename(p), p);
      fileLookup.set(path.basename(withoutExt), p);
    }

    for (const [sourcePath, data] of this.fileData.entries()) {
      const sourceDir = path.dirname(sourcePath);
      for (const importSpec of data.imports) {
        let resolved = null;
        if (importSpec.startsWith("./") || importSpec.startsWith("../")) {
          const joined = path.posix.normalize(path.posix.join(sourceDir, importSpec));
          resolved = fileLookup.get(joined) || fileLookup.get(joined.replace(/\.[^/.]+$/, ""));
        } else {
          resolved = fileLookup.get(importSpec) || fileLookup.get(path.basename(importSpec));
        }

        if (resolved && resolved !== sourcePath) {
          this.importGraph.get(sourcePath)?.add(resolved);
          if (!this.reverseImportGraph.has(resolved)) {
            this.reverseImportGraph.set(resolved, new Set());
          }
          this.reverseImportGraph.get(resolved).add(sourcePath);
        }
      }
    }
  }

  getRelatedFiles(targetFilePath) {
    const normalized = targetFilePath.split(path.sep).join("/");
    const directImports = Array.from(this.importGraph.get(normalized) || []);
    const importedBy = Array.from(this.reverseImportGraph.get(normalized) || []);
    return {
      directImports,
      importedBy,
      related: [...new Set([...directImports, ...importedBy])],
    };
  }

  findFilesForSymbol(symbolName) {
    return Array.from(this.symbolToFile.get(symbolName) || []);
  }
}
