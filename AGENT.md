# AGENT.md — Roblox Studio MCP

> This doc tells AI agents how to operate this MCP. If you're a human setting it up, follow the numbered install steps and give this file to your AI agent afterward.

---

## 1. Install (Human Does This Once)

```bash
git clone https://github.com/aaronaalmendarez/roblox-mcp.git
cd roblox-mcp
npm install
npm run build
npm run build:plugin
npm run luau:install

# Copy plugin to Studio
# Windows:  copy "studio-plugin\MCPPlugin.rbxmx" "%LOCALAPPDATA%\Roblox\Plugins\"
# macOS:    cp studio-plugin/MCPPlugin.rbxmx ~/Documents/Roblox/Plugins/
# Then restart Roblox Studio
```

**In Studio:** Game Settings → Security → ✅ Allow HTTP Requests. Open a place, then click the MCP plugin button in the Plugins toolbar to connect.

**Add MCP to your AI client:**
```bash
# Claude Code
claude mcp add robloxstudio -- node /path/to/roblox-mcp/dist/index.js

# Cursor/Windsurf JSON config
{ "mcpServers": { "robloxstudio": { "command": "node", "args": ["/path/to/roblox-mcp/dist/index.js"] } } }
```

---

## 2. The Studio CLI — Your Daily Driver

This repo ships a **zero-dependency CLI** that orchestrates the entire workflow. Use it for everything.

```bash
npm run studio -- dev --place <slug>     # Start everything
npm run studio -- status                  # Check health
npm run studio -- place list              # See all places
npm run studio -- stop                    # Kill all processes
```

### Why use the CLI?

| Feature | Benefit |
|---------|---------|
| **PID tracking** | Every spawned process gets a PID file. No orphaned `node.exe` processes. |
| **Tree kill** | `studio stop` kills the entire process tree (not just the shell). |
| **Log capture** | Background services write timestamped logs to `.studio-cli/logs/`. |
| **Health checks** | Waits for MCP HTTP and Rojo TCP before reporting "ready". |
| **Place context** | Auto-resolves active place, detected Studio place, or legacy fallback. |
| **Beautiful UI** | ANSI boxes, spinners, tables — works in any terminal. |

### Full command reference

```bash
studio dev              # MCP + Rojo + Watch + Reverse sync
studio serve            # Rojo server only
studio mcp              # MCP server only
studio sync             # One-shot property sync
studio watch            # Property file watcher
studio build            # Build .rbxl via Rojo
studio lint             # Luau lint
studio place list       # Places table with active marker
studio place status     # Resolved context box
studio place use <key>  # Switch active place
studio place detect     # Auto-register current Studio place
studio status           # System dashboard
studio stop [name]      # Kill tracked process(es)
studio transcribe       # Whisper transcription
studio doctor           # Blueprint doctor
studio version          # Version + logo
```

### Global flags

```bash
--place <key>     # Target place (slug / id / name)
--verbose         # Show process output
--json            # Machine-readable output
--dry-run         # Preview changes without applying
```

---

## 3. What This Is

An MCP server that lets AI agents read/write Luau scripts, execute code, create instances, and run playtests inside Roblox Studio.

**Two ways to work:**

| Approach | When to use |
|----------|-------------|
| **Blueprint V1 + Rojo** (RECOMMENDED) | Persistent projects. Edit `.luau` files locally, Rojo syncs to Studio automatically. |
| **MCP direct** | Quick patches, geometry, instances, or when Rojo isn't running. |

---

## 4. Blueprint V1 — The Golden Path

This is how you build games with this MCP. Do not skip this.

### 3.1 Register the Place

```bash
npm run studio -- place detect     # Detects open Studio place, creates mapping
npm run studio -- place status     # Verify it resolved to Mode: place (not legacy)
```

This creates `blueprint-v1/places/<slug>/` with:
- `default.project.json` — Rojo config
- `src/` — your `.luau` source files
- `properties/instances.json` — non-script properties/attributes/tags

### 3.2 Start the Dev Environment

```bash
npm run studio -- dev --place <slug>
```

This starts **four processes:**
1. **MCP server** — `localhost:3002` (Studio plugin talks to this)
2. **Rojo** — `localhost:34872` (syncs local `.luau` files → Studio)
3. **Property watcher** — watches `instances.json`, syncs props/attrs/tags to Studio
4. **Reverse sync** — pulls Studio-side script changes back to local files

> **Legacy:** `npm run dev:studio -- --place <slug>` still works if you prefer the old orchestrator.

### 3.3 Edit Local Files, Not Studio

**The rule:** Always edit files in `blueprint-v1/places/<slug>/src/`. Rojo pushes them to Studio automatically. Never use `set_script_source` or `create_object("Script")` for scripts when Rojo is active — it causes duplicates.

| File suffix | Script Type | Example |
|-------------|-------------|---------|
| `.server.luau` | Script (server) | `GameLoop.server.luau` |
| `.client.luau` | LocalScript (client) | `HUD.client.luau` |
| `.luau` | ModuleScript | `Config.luau` |

> ⚠️ **Never use `.module.luau`** — Rojo does NOT strip `.module` from the name.

### 3.4 instances.json — Properties/Attributes/Tags

Edit `blueprint-v1/places/<slug>/properties/instances.json` to sync non-script data:

```json
{
  "instances": [
    {
      "path": "game.ReplicatedStorage.HollowPurple",
      "properties": { "Name": "HollowPurple" },
      "attributes": { "Damage": 100 },
      "tags": ["Ability"]
    }
  ]
}
```

The property watcher auto-detects saves and pushes to Studio. `instances` must be an **array** `[]`, not an object `{}`.

### 3.5 Luau Lint (Run After Every Change)

```bash
npm run studio -- lint
```

Or run strict:
```bash
npm run studio -- lint --strict --fail-on-findings
```

Expected output: `findings=0`. Fix everything before pushing/committing.

Common fixes:
- `Unknown global 'tick'` → use `os.clock()`
- `LocalUnused: Variable 'X'` → rename to `_X`

### 3.6 When Rojo Is NOT Running

If Rojo is down, push scripts manually:

```bash
node scripts/push-script-fast.mjs \
  --instance game.ServerScriptService.GameLoop \
  --file blueprint-v1/places/<slug>/src/ServerScriptService/GameLoop.server.luau
```

---

## 5. MCP Direct — When Blueprint Is Off

Use MCP tools directly for:
- Creating/modifying **geometry** (Parts, Folders, RemoteEvents)
- Quick **script patches** when Rojo isn't running
- **Playtests** (`start_playtest`, `get_playtest_output`, `stop_playtest`)
- Running arbitrary **Luau** (`execute_luau`)

**Key tools:**
- `get_project_structure` — explore the game tree
- `get_script_source` / `get_script_snapshot` — read scripts
- `set_script_source` / `edit_script_lines` / `batch_script_edits` — write scripts
- `create_object` / `create_object_with_properties` — make instances
- `set_property` / `set_attribute` / `add_tag` — modify instances
- `execute_luau` — run any code in Studio edit context

---

## 6. Key Commands

### CLI (Recommended)

| Command | What it does |
|---------|-------------|
| `npm run studio -- dev --place <slug>` | Start MCP + Rojo + watchers + reverse sync |
| `npm run studio -- mcp` | MCP server only |
| `npm run studio -- serve` | Rojo server only |
| `npm run studio -- place detect` | Register current Studio place |
| `npm run studio -- place status` | Show active place context |
| `npm run studio -- place list` | List all registered places |
| `npm run studio -- place use <key>` | Switch active place |
| `npm run studio -- sync` | One-shot property sync |
| `npm run studio -- watch` | Property file watcher |
| `npm run studio -- build` | Build .rbxl via Rojo |
| `npm run studio -- lint` | Luau static analysis |
| `npm run studio -- status` | System health dashboard |
| `npm run studio -- stop` | Kill all tracked processes |
| `npm run studio -- doctor` | Full connectivity check |

### Legacy npm scripts (still work)

| Command | What it does |
|---------|-------------|
| `npm run dev:studio -- --place <slug>` | Legacy orchestrator |
| `npm run place:detect` | Same as `studio place detect` |
| `npm run blueprint:watch` | Property watcher |
| `npm run blueprint:reverse-sync` | Pull Studio scripts → local |
| `npm run blueprint:sync` | One-shot instances.json sync |
| `npm run blueprint:doctor` | Same as `studio doctor` |
| `npm run luau:lint` | Same as `studio lint` |
| `npm run build` | Compile TS → dist/ |
| `npm run build:plugin` | Build Studio plugin .rbxmx |

---

## 7. Troubleshooting

| Problem | Fix |
|---------|-----|
| `pluginConnected: false` | Studio plugin not connected. Click Connect in Plugins toolbar. |
| `EADDRINUSE :3002` | MCP server already running. Run `npm run studio -- stop` or use the existing one. |
| `EADDRINUSE :34872` | Rojo already running. Run `npm run studio -- stop` first. |
| Place resolves to `legacy` | Run `npm run studio -- place detect` again. |
| `"Manifest must contain an instances array"` | `instances.json` has `{}` instead of `[]`. |
| Large script writes fail | Use `push-script-fast.mjs` or chunked upload tools. |
| `set_property cannot be used for Source` | Expected — use `set_script_source` or push scripts via Rojo. |
| Orphaned `node.exe` processes | Run `npm run studio -- stop` to kill tracked processes. Check Task Manager for stragglers. |
| Process crashes silently | Check `.studio-cli/logs/<name>.log` for timestamped stdout/stderr. |

---

*Version: 2.3.0*
