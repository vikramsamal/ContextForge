# ContextForge Architecture

ContextForge is a **local-first intent compiler for AI coding agents**. It bridges the gap between concise, ambiguous human intent and precise, context-aware prompt specifications for coding agents.

```
                    Human Intent (Terse, Non-Native, Multi-turn)
                                       │
                                       ▼
                             ┌───────────────────┐
                             │  Intent Analysis  │
                             └─────────┬─────────┘
                                       │
                 ┌─────────────────────┼─────────────────────┐
                 │                     │                     │
                 ▼                     ▼                     ▼
       ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
       │ Conversation     │  │  Project Scanner │  │ Git Awareness    │
       │ Memory & State   │  │  & Symbol Graph  │  │ & Worktree       │
       └─────────┬────────┘  └─────────┬────────┘  └─────────┬────────┘
                 │                     │                     │
                 └─────────────────────┼─────────────────────┘
                                       │
                                       ▼
                             ┌───────────────────┐
                             │ Relevance Engine  │
                             └─────────┬─────────┘
                                       │
                                       ▼
                             ┌───────────────────┐
                             │ Ambiguity & Scope │
                             └─────────┬─────────┘
                                       │
                                       ▼
                             ┌───────────────────┐
                             │ Context Optimizer │
                             └─────────┬─────────┘
                                       │
                                       ▼
                             ┌───────────────────┐
                             │ Prompt Compiler   │
                             └─────────┬─────────┘
                                       │
                                       ▼
                              AI Coding Agent
```

---

## Core Components

### 1. Intent Analyzer (`core/intent/`)
- Extracts technical intent without judging grammar or English proficiency.
- Extracts target domains, explicit file paths, and negative constraints ("don't change X").
- Derives scope boundaries (`Allowed` vs `Prohibited`).

### 2. Conversation Memory (`core/conversation/`)
- Preserves context across multi-turn sessions without dumping irrelevant conversation text.
- Classifies turns into `REQUIREMENT`, `CONSTRAINT`, `DECISION`, `QUESTION`, `CORRECTION`, `REJECTED_APPROACH`, `IMPLEMENTATION_DETAIL`, and `IRRELEVANT`.
- Applies rule superseding: when a correction occurs (e.g. "Actually, redesign the upload UI"), old conflicting constraints are deactivated.

### 3. Ambiguity & No-Hallucination Engine (`core/ambiguity/`)
- Detects underspecified requests ("make it faster", "fix the thing").
- Labels information strictly as `FACT`, `INFERENCE`, `ASSUMPTION`, or `UNKNOWN`.
- Formulates clarifying questions when unresolved.

### 4. Project Scanner & Dependency Graph (`project/`)
- Safe, read-only scanning excluding `.git`, `node_modules`, `.env`, build directories, and binaries.
- Symbol and import extraction across JavaScript/TypeScript, Python, Go, Rust.
- Resolves file dependencies, direct imports, and reverse imports.
- Incremental indexing cache based on file `mtime` and content hashes.

### 5. Relevance Engine (`core/relevance/`)
- Multi-signal scoring combining:
  - Exact file reference (+0.55)
  - Path token overlap (+0.25)
  - Content keyword density (+0.30)
  - Defined symbol overlap (+0.20)
  - Dependency/import relationships (+0.15)
  - Git modification status (+0.10)
  - Related test files (+0.10)
  - Project metadata/manifests (+0.05)

### 6. Token Optimization (`core/optimization/`)
- Allocates token budgets based on mode (`fast`: 3k tokens, `standard`: 8k tokens, `deep`: 18k tokens).
- Classifies context into `Required`, `Supporting`, `Optional`, and `Excluded`.
- Reports exact token reductions and byte statistics.

### 7. MCP Server (`mcp/`)
- Standards-compliant Model Context Protocol server over stdio JSON-RPC 2.0.
- Exposes 10 read-only tools for seamless integration with AI coding assistants.

### 8. Evaluation Framework (`eval/`)
- Golden dataset covering diverse real-world edge cases (non-native English, ambiguous requests, multi-turn superseding, monorepo backend tasks, MCP tasks).
- Automated regression suite measuring intent preservation, constraint fidelity, and ambiguity detection.
