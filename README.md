# ContextForge

ContextForge is a local-first **context-aware intent compiler for AI coding agents**. It transforms terse, ambiguous, incomplete, or non-native human requests into precise, grounded, and constraint-preserving prompt specifications.

```
Human Intent  ──▶  ContextForge (Scanner + Memory + Relevance + Ambiguity)  ──▶  AI Coding Agent
```

---

## Key Capabilities

- **Intent & Constraint Extraction**: Captures technical intent regardless of imperfect grammar or phrasing.
- **Scope Protection**: Formulates strict `Allowed` vs `Prohibited` boundaries (e.g., "don't change UI").
- **Conversation Memory**: Preserves requirements across multi-turn chats while automatically superseding outdated constraints.
- **Dependency & Symbol Graph**: Understands imports, exports, and relationships across JS/TS, Python, Go, and Rust.
- **Ambiguity & No-Hallucination**: Flags missing specifics and distinguishes `FACT`, `INFERENCE`, `ASSUMPTION`, and `UNKNOWN`.
- **Relevance Scoring**: Ranks files using multi-signal scoring (keyword, symbol, path, dependency graph, Git recency, and tests).
- **Token Optimization**: Truncates irrelevant content and reports exact token reductions.
- **Built-in MCP Server**: Exposes 10 standard Model Context Protocol tools for seamless IDE/agent integration.
- **Zero Runtime Dependencies**: Runs natively on Node.js 20+ with 100% local, private execution.

---

## Installation & Requirements

Requires **Node.js 20** or newer.

```bash
# Link globally
npm link

# Or run directly
node cli/contextforge.js "fix login after refresh but don't touch UI"
```

---

## CLI Usage

### Compile a Prompt
```bash
contextforge "fix dashboard card rendering don't change other components"
```

### Inspect Project Context
```bash
contextforge scan --root /path/to/project
contextforge status --root /path/to/project
contextforge search "authentication session" --root /path/to/project
```

### Explain & View Context Selection
```bash
contextforge explain "speed up database queries" --root /path/to/project
contextforge stats "fix login" --root /path/to/project
```

### Multi-turn Conversation Input
```bash
contextforge compile "make upload work with s3" --conversation history.json
```

### Start MCP Server
```bash
contextforge mcp
```

### Run Evaluation Suite & Golden Dataset
```bash
contextforge eval
```

---

## Context Retrieval Modes

- `fast`: Minimal inspection for simple, explicit tasks.
- `standard`: Balanced analysis with tests, docs, and Git status (default).
- `deep`: Multi-module analysis with broad dependency graph inspection.

---

## MCP Server Integration

Add ContextForge to your agent's MCP configuration (`claude_desktop_config.json`, Antigravity `mcp_config.json`, or Cursor):

```json
{
  "mcpServers": {
    "contextforge": {
      "command": "node",
      "args": ["/path/to/ContextForge/cli/contextforge.js", "mcp"]
    }
  }
}
```

Exposed MCP Tools:
- `contextforge.scan_project`
- `contextforge.search_project`
- `contextforge.get_project_context`
- `contextforge.get_relevant_files`
- `contextforge.get_conversation_context`
- `contextforge.analyze_intent`
- `contextforge.detect_ambiguity`
- `contextforge.compile_prompt`
- `contextforge.validate_prompt`
- `contextforge.get_context_stats`

---

## Documentation

- [Architecture Guide](docs/ARCHITECTURE.md)
- [MCP Integration Guide](docs/MCP_GUIDE.md)
- [Configuration Reference](docs/CONFIGURATION.md)

---

## Development & Testing

```bash
npm test
npm run check
```
