# ContextForge MCP Integration Guide

ContextForge includes a built-in [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that runs over standard input/output (`stdio`).

## Starting the MCP Server

```bash
contextforge mcp
```

Or with Node directly:

```bash
node cli/contextforge.js mcp
```

---

## Configuring with AI Agents & IDEs

### Claude Desktop
Add ContextForge to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "contextforge": {
      "command": "node",
      "args": ["/absolute/path/to/ContextForge/cli/contextforge.js", "mcp"]
    }
  }
}
```

### Google Antigravity / Cursor / Custom Agent
Add to your `mcp_config.json`:

```json
{
  "mcpServers": {
    "contextforge": {
      "command": "node",
      "args": ["/absolute/path/to/ContextForge/cli/contextforge.js", "mcp"]
    }
  }
}
```

---

## Exposed MCP Tools

| Tool Name | Description |
|---|---|
| `contextforge.scan_project` | Safe, read-only project scan (languages, frameworks, file structure). |
| `contextforge.search_project` | Relevance-ranked search across project files and symbols. |
| `contextforge.get_project_context` | Tech stack overview and Git branch/status. |
| `contextforge.get_relevant_files` | Prioritized relevant files and excerpts for a task. |
| `contextforge.get_conversation_context`| Multi-turn history state (requirements, constraints, decisions). |
| `contextforge.analyze_intent` | Intent, target domain, explicit constraints, and scope boundaries. |
| `contextforge.detect_ambiguity` | Ambiguity analysis and targeted clarifying questions. |
| `contextforge.compile_prompt` | End-to-end prompt compilation from raw user input. |
| `contextforge.validate_prompt` | Validates prompt against active constraints. |
| `contextforge.get_context_stats` | Token breakdown and context reduction metrics. |
