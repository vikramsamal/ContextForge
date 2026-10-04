# ContextForge Configuration

ContextForge can be configured globally or per-project using a JSON file:
- `contextforge.config.json`
- `.contextforgerc.json`

## Example Configuration

```json
{
  "mode": "standard",
  "maxFiles": 8,
  "maxFileBytes": 262144,
  "includeGit": true,
  "includeTests": true,
  "includeDocumentation": true,
  "llmProvider": "heuristic"
}
```

---

## Configuration Options

| Option | Type | Default | Description |
|---|---|---|---|
| `mode` | `string` | `"standard"` | Retrieval depth: `"fast"`, `"standard"`, or `"deep"`. |
| `maxFiles` | `number` | `8` | Maximum number of files included in compiled prompt context. |
| `maxFileBytes` | `number` | `262144` (256KB) | Maximum size of individual files read during deep scans. |
| `includeGit` | `boolean` | `true` | Include read-only Git branch, worktree status, and recent commits. |
| `includeTests` | `boolean` | `true` | Include relevant test files in context. |
| `includeDocumentation` | `boolean` | `true` | Include markdown/docs when relevant. |
| `llmProvider` | `string` | `"heuristic"` | Pluggable LLM layer: `"heuristic"` (default, 100% local), `"ollama"`, or `"openai"`. |

---

## LLM Provider Configuration

### Ollama (Local)
```json
{
  "llmProvider": "ollama",
  "ollama": {
    "baseUrl": "http://localhost:11434",
    "model": "llama3"
  }
}
```

### OpenAI / OpenAI-Compatible (Local / Cloud)
```json
{
  "llmProvider": "openai",
  "openai": {
    "baseUrl": "https://api.openai.com/v1",
    "apiKey": "${OPENAI_API_KEY}",
    "model": "gpt-4o-mini"
  }
}
```
