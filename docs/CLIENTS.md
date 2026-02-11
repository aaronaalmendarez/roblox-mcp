# MCP Client Configurations

Roblox Studio MCP uses **stdio transport** and is provider-agnostic — it works with any MCP host that can launch a local command.

---

## Universal Command

Use this in any client that accepts a command string:

```
npx -y robloxstudio-mcp@latest
```

> **Windows note:** If `npx` fails to resolve, prefix with `cmd /c`:
> ```
> cmd /c npx -y robloxstudio-mcp@latest
> ```

---

## Claude Code

```bash
claude mcp add robloxstudio -- npx robloxstudio-mcp
```

## Gemini CLI

```bash
gemini mcp add robloxstudio npx --trust -- -y robloxstudio-mcp
```

## Claude Desktop

Add to your `claude_desktop_config.json`:

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

<details>
<summary>Windows fallback</summary>

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
</details>

## Codex CLI

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.robloxstudio]
command = "npx"
args = ["-y", "robloxstudio-mcp@latest"]
```

<details>
<summary>Windows fallback</summary>

```toml
[mcp_servers.robloxstudio]
command = "cmd"
args = ["/c", "npx", "-y", "robloxstudio-mcp@latest"]
```
</details>

## OpenCode

Add to `~/.config/opencode/opencode.json`:

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

<details>
<summary>Windows fallback</summary>

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
</details>

## Other mcpServers JSON Clients

Any client that reads a `mcpServers` JSON block (Cursor, Windsurf, etc.):

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

---

## Validation Checklist

After setup, verify everything is connected:

1. ✅ Roblox Studio is open and the plugin is active (green indicator)
2. ✅ **Game Settings → Security → Allow HTTP Requests** is enabled
3. ✅ MCP client shows the server as connected
4. ✅ Calling `get_place_info` returns a valid response

### Quick health check

```bash
curl http://localhost:3002/health
```

Expected: `pluginConnected: true`, `mcpServerActive: true`
