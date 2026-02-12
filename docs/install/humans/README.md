# Installation Guide (Humans)

This guide is for developers who want to run Roblox Studio MCP manually.

## 1) Prerequisites

- Windows or macOS
- Roblox Studio installed
- Node.js 18+ and npm
- Git
- Optional: Rojo (for IDE-first sync)

## 2) Clone and install

```powershell
git clone https://github.com/aaronaalmendarez/roblox-mcp.git
cd roblox-mcp
npm install
```

## 3) Build server + plugin

```powershell
npm run build
npm run build:plugin
```

This generates:

- MCP server runtime: `dist/index.js`
- Roblox plugin file: `studio-plugin/MCPPlugin.rbxmx`

## 4) Install plugin into Roblox Studio

Copy:

- `studio-plugin/MCPPlugin.rbxmx`

To:

- `C:\Users\<you>\AppData\Local\Roblox\Plugins\MCPPlugin.rbxmx`

Then restart Roblox Studio.

## 5) Enable Studio settings

In Roblox Studio:

1. Open your place.
2. Go to `Game Settings > Security`.
3. Enable `Allow HTTP Requests`.
4. Open the plugin and confirm it shows connected.

## 6) Start MCP server

From repo root:

```powershell
npm run build
node dist/index.js
```

Health checks:

```powershell
Invoke-RestMethod http://localhost:3002/health
Invoke-RestMethod http://localhost:3002/status
```

## 7) Connect your MCP client

### Codex (`~/.codex/config.toml`)

```toml
[mcp_servers.robloxstudio]
command = "node"
args = ["C:/path/to/roblox-mcp/dist/index.js"]
```

Or package mode:

```toml
[mcp_servers.robloxstudio]
command = "npx"
args = ["-y", "@aaronalm19/roblox-mcp@latest"]
```

### Claude / OpenCode / others

Use the same command pattern:

```text
npx -y @aaronalm19/roblox-mcp@latest
```

See `docs/CLIENTS.md` for full client examples.

## 8) Multi-place setup (recommended)

Detect and register active Studio place:

```powershell
npm run place:detect
```

Inspect resolved context:

```powershell
npm run place:status
npm run place:list
```

## 9) Daily workflow

1. Start Studio + plugin.
2. Start MCP server: `node dist/index.js`
3. Register/select place: `npm run place:detect`
4. Optional Rojo: `rojo serve <resolved project path>`
5. Property sync:
   - one-shot: `npm run blueprint:sync`
   - watch: `npm run blueprint:watch`
6. Reverse sync (guarded): `npm run blueprint:reverse-sync`

## 10) Luau lint integration

Install official Luau CLI:

```powershell
npm run luau:install
```

Lint active place source:

```powershell
npm run luau:lint
```

Strict lint (fails on findings):

```powershell
npm run luau:lint:strict
```

## 11) Troubleshooting

If MCP says enabled but has no tools:

1. Restart Studio.
2. Re-enable plugin.
3. Verify `/health` shows `pluginConnected: true`.
4. In Codex, re-open MCP with `/mcp`.

If full-source writes are slow:

- Prefer `node scripts/push-script-fast.mjs --instance <path> --file <file>`.
