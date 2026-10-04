import path from "node:path";

const JS_IMPORT_REGEX = /(?:import\s+(?:(?:[\w*\s{},]+)\s+from\s+)?['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\))/g;
const JS_EXPORT_SYMBOL_REGEX = /(?:export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)|export\s+class\s+([A-Za-z0-9_$]+)|export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)|export\s+type\s+([A-Za-z0-9_$]+)|export\s+interface\s+([A-Za-z0-9_$]+))/g;

const PY_IMPORT_REGEX = /(?:from\s+([A-Za-z0-9_.]+)\s+import|import\s+([A-Za-z0-9_.,\s]+))/g;
const PY_SYMBOL_REGEX = /(?:def\s+([A-Za-z0-9_]+)|class\s+([A-Za-z0-9_]+))/g;

const GO_IMPORT_REGEX = /import\s+(?:\(\s*([^)]+)\s*\)|"([^"]+)")/g;
const GO_SYMBOL_REGEX = /func\s+(?:\([^)]+\)\s+)?([A-Za-z0-9_]+)/g;

const RUST_USE_REGEX = /use\s+([^;]+);/g;
const RUST_SYMBOL_REGEX = /(?:fn\s+([A-Za-z0-9_]+)|struct\s+([A-Za-z0-9_]+)|enum\s+([A-Za-z0-9_]+)|trait\s+([A-Za-z0-9_]+))/g;

export function extractDependenciesAndSymbols(filePath, content = "") {
  const ext = path.extname(filePath).toLowerCase();
  const imports = new Set();
  const symbols = new Set();

  if (!content) {
    return { imports: [], symbols: [] };
  }

  if ([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"].includes(ext)) {
    // JS / TS
    let match;
    JS_IMPORT_REGEX.lastIndex = 0;
    while ((match = JS_IMPORT_REGEX.exec(content)) !== null) {
      const spec = match[1] || match[2];
      if (spec) imports.add(spec);
    }
    JS_EXPORT_SYMBOL_REGEX.lastIndex = 0;
    while ((match = JS_EXPORT_SYMBOL_REGEX.exec(content)) !== null) {
      const sym = match[1] || match[2] || match[3] || match[4] || match[5];
      if (sym) symbols.add(sym);
    }
  } else if (ext === ".py") {
    // Python
    let match;
    PY_IMPORT_REGEX.lastIndex = 0;
    while ((match = PY_IMPORT_REGEX.exec(content)) !== null) {
      const spec = (match[1] || match[2] || "").trim();
      if (spec) imports.add(spec);
    }
    PY_SYMBOL_REGEX.lastIndex = 0;
    while ((match = PY_SYMBOL_REGEX.exec(content)) !== null) {
      const sym = match[1] || match[2];
      if (sym) symbols.add(sym);
    }
  } else if (ext === ".go") {
    // Go
    let match;
    GO_IMPORT_REGEX.lastIndex = 0;
    while ((match = GO_IMPORT_REGEX.exec(content)) !== null) {
      const raw = match[1] || match[2];
      if (raw) {
        for (const line of raw.split("\n")) {
          const clean = line.replace(/["\s]/g, "");
          if (clean) imports.add(clean);
        }
      }
    }
    GO_SYMBOL_REGEX.lastIndex = 0;
    while ((match = GO_SYMBOL_REGEX.exec(content)) !== null) {
      if (match[1]) symbols.add(match[1]);
    }
  } else if (ext === ".rs") {
    // Rust
    let match;
    RUST_USE_REGEX.lastIndex = 0;
    while ((match = RUST_USE_REGEX.exec(content)) !== null) {
      if (match[1]) imports.add(match[1].trim());
    }
    RUST_SYMBOL_REGEX.lastIndex = 0;
    while ((match = RUST_SYMBOL_REGEX.exec(content)) !== null) {
      const sym = match[1] || match[2] || match[3] || match[4];
      if (sym) symbols.add(sym);
    }
  }

  return {
    imports: [...imports],
    symbols: [...symbols],
  };
}
