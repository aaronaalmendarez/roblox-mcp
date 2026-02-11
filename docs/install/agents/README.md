# Installation Guide (Agents)

This guide is optimized for AI agents (Codex, Claude Code, OpenCode, etc.) that need deterministic setup and validation.

## Goal

Provide a reproducible local MCP environment where:

- Studio plugin is connected
- MCP server is reachable on `http://localhost:3002`
- agent can resolve current place context
- sync scripts work without manual path edits

## 1) Bootstrap repo

```powershell
git clone https://github.com/aaronaalmendarez/roblox-mcp.git
cd roblox-mcp
npm install
npm run build
npm run build:plugin
```

## 2) Install plugin artifact

Copy:

- `studio-plugin/MCPPlugin.rbxmx`

To:

- `%LOCALAPPDATA%\\Roblox\\Plugins\\MCPPlugin.rbxmx`

Restart Roblox Studio after copy.

## 3) Studio preconditions

Agent should verify human completed:

1. Place open in Studio.
2. `Allow HTTP Requests` enabled.
3. MCP plugin enabled.

## 4) Start MCP server

```powershell
node dist/index.js
```

Server checks:

```powershell
Invoke-RestMethod http://localhost:3002/health
Invoke-RestMethod http://localhost:3002/status
```

Required:

- `pluginConnected = true`
- `mcpServerActive = true`

## 5) Configure MCP client

### Codex (`~/.codex/config.toml`)

```toml
[mcp_servers.robloxstudio]
command = "node"
args = ["C:/path/to/roblox-mcp/dist/index.js"]
```

Package fallback:

```toml
[mcp_servers.robloxstudio]
command = "npx"
args = ["-y", "robloxstudio-mcp@latest"]
```

For other clients, follow `docs/CLIENTS.md`.

## 6) Place registration handshake

Run:

```powershell
npm run place:detect
npm run place:status
```

Expected:

- mode resolves to `place` (or `legacy` if fallback intentionally used)
- resolved project and properties paths are printed

## 7) Agent verification checklist

Run all:

```powershell
npm run blueprint:doctor
npm run typecheck
npm test -- --runInBand
```

Optional live dry-run:

```powershell
node scripts/sync-roblox-properties.mjs --dry-run
```

## 8) Fast-path write strategy

Prefer this order:

1. `batch_script_edits`
2. `set_script_source_checked`
3. `set_script_source_fast`
4. `scripts/push-script-fast.mjs` for very large rewrites

Example:

```powershell
node scripts/push-script-fast.mjs --instance game.ServerScriptService.Main --file blueprint-v1/places/<slug>/src/ServerScriptService/Main.server.luau
```

Note:

- Harness push scripts auto-strip UTF-8 BOM before writing to Studio to prevent Luau parse errors (`U+FEFF`).

## 9) Failure handling

If startup handshake fails (`connection closed: initialize response`):

1. Ensure server process is running.
2. Ensure Studio plugin is loaded and active.
3. Re-check `http://localhost:3002/health`.
4. Restart Studio, then MCP client.

If place context fails:

```powershell
node scripts/places.mjs detect --init-if-missing --set-active
```

## 10) Non-interactive agent playbook

Suggested deterministic sequence:

```powershell
npm install
npm run build
npm run build:plugin
npm run place:detect
npm run blueprint:doctor
npm run place:status
```

Only proceed to write operations after doctor + place status are healthy.
