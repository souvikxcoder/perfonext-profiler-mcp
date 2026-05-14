# perfonext-profiler-mcp

`perfonext-profiler-mcp` is an MCP server for loading and analyzing V8 and Chrome CPU profiles. It gives GitHub Copilot and other MCP clients structured performance data they can reason over instead of forcing the model to ingest multi-megabyte profile dumps.

## What It Does

- loads `.cpuprofile` files and Chrome trace exports that contain CPU profile data
- identifies the hottest functions by self time
- explains caller and callee relationships for a selected function
- compares two profiles to surface regressions and improvements
- returns deterministic optimization suggestions for common hotspots
- summarizes loaded profiles so an MCP client can keep context tight

## Tools

| Tool | Description |
|------|-------------|
| `load_profile` | Parse and load a `.cpuprofile` file or Chrome trace export from disk |
| `get_hotspots` | Find top functions by self-time |
| `explain_function` | Explain a function's timing, callers, and callees |
| `compare_profiles` | Compare two profiles and highlight regressions |
| `suggest_optimizations` | Generate deterministic optimization suggestions for hot functions |
| `get_profile_summary` | Summarize one profile or list all loaded profiles |

## Install

Run directly with `npx`:

```bash
npx -y @perfonext/profiler-mcp
```

Or install globally:

```bash
npm install -g @perfonext/profiler-mcp
```

The executable command remains `perfonext-profiler-mcp` after installation.

## MCP Configuration

Add this server to VS Code `settings.json`:

```json
{
  "mcp": {
    "servers": {
      "perfonext-profiler": {
        "command": "npx",
        "args": ["-y", "@perfonext/profiler-mcp"]
      }
    }
  }
}
```

## Example Copilot Prompts

- "Load the CPU profile at `./profile.cpuprofile` and show me the top hotspots."
- "Explain why `processData` is expensive in the loaded profile."
- "Compare my baseline and current CPU profiles and tell me what got slower."
- "Suggest optimizations for the top three hotspots."

## Development

```bash
npm install
npm run build
npm test
```

The repository already includes sample fixtures under `tests/fixtures/` for local validation.

## Generating a CPU Profile

Node.js:

```bash
node --cpu-prof your-script.js
```

Chrome DevTools:

1. Open DevTools and go to the Performance tab.
2. Record the scenario you want to inspect.
3. Stop recording and save the result as a `.cpuprofile` export.

## License

MIT
