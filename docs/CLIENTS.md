# MCP Client Configurations

This server is provider-agnostic and uses MCP stdio transport, so it works with any MCP host that can launch a local command.

## Shared command

Use this command in any MCP client:

```text
npx -y robloxstudio-mcp@latest
```

If your client has trouble resolving `npx` on Windows, use:

```text
cmd /c npx -y robloxstudio-mcp@latest
```

## Codex CLI

File: `~/.codex/config.toml`

```toml
[mcp_servers.robloxstudio]
command = "npx"
args = ["-y", "robloxstudio-mcp@latest"]
```

Windows fallback:

```toml
[mcp_servers.robloxstudio]
command = "cmd"
args = ["/c", "npx", "-y", "robloxstudio-mcp@latest"]
```

## OpenCode

File: `~/.config/opencode/opencode.json`

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "robloxstudio": {
      "type": "local",
      "enabled": true,
      "command": ["npx", "-y", "robloxstudio-mcp@latest"]
    }
  }
}
```

Windows fallback:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "robloxstudio": {
      "type": "local",
      "enabled": true,
      "command": ["cmd", "/c", "npx", "-y", "robloxstudio-mcp@latest"]
    }
  }
}
```

## Claude Code

```bash
claude mcp add robloxstudio -- npx robloxstudio-mcp
```

## Gemini CLI

```bash
gemini mcp add robloxstudio npx --trust -- -y robloxstudio-mcp
```

## Claude Desktop and other mcpServers JSON clients

```json
{
  "mcpServers": {
    "robloxstudio-mcp": {
      "command": "npx",
      "args": ["-y", "robloxstudio-mcp@latest"]
    }
  }
}
```

Windows fallback:

```json
{
  "mcpServers": {
    "robloxstudio-mcp": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "robloxstudio-mcp@latest"]
    }
  }
}
```

## Validation checklist

1. Roblox Studio plugin is active.
2. Game Settings > Security > Allow HTTP Requests is enabled.
3. MCP client shows the server as connected.
4. Calling `get_place_info` returns a response.
