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

## 2. What This Is

An MCP server that lets AI agents read/write Luau scripts, execute code, create instances, and run playtests inside Roblox Studio.

**Two ways to work:**

| Approach | When to use |
|----------|-------------|
| **Blueprint V1 + Rojo** (RECOMMENDED) | Persistent projects. Edit `.luau` files locally, Rojo syncs to Studio automatically. |
| **MCP direct** | Quick patches, geometry, instances, or when Rojo isn't running. |

---

## 3. Blueprint V1 — The Golden Path

This is how you build games with this MCP. Do not skip this.

### 3.1 Register the Place

```bash
npm run place:detect     # Detects open Studio place, creates mapping
npm run place:status     # Verify it resolved to Mode: place (not legacy)
```

This creates `blueprint-v1/places/<slug>/` with:
- `default.project.json` — Rojo config
- `src/` — your `.luau` source files
- `properties/instances.json` — non-script properties/attributes/tags

### 3.2 Start the Dev Environment

```bash
npm run dev:studio -- --place <slug> --with-rojo --with-watch --with-reverse
```

This starts **four processes:**
1. **MCP server** — `localhost:58741` (Studio plugin talks to this)
2. **Rojo** — `localhost:34872` (syncs local `.luau` files → Studio)
3. **Property watcher** — watches `instances.json`, syncs props/attrs/tags to Studio
4. **Reverse sync** — pulls Studio-side script changes back to local files

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
npm run luau:lint
```

Expected output: `[luau-lint] findings=0`. Fix everything before pushing/committing.

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

## 4. MCP Direct — When Blueprint Is Off

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

## 5. Key npm Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev:studio -- --place <slug>` | Start MCP + Rojo + watchers |
| `npm run place:detect` | Register current Studio place |
| `npm run place:status` | Show active place paths |
| `npm run blueprint:watch` | Property watcher (instances.json → Studio) |
| `npm run blueprint:reverse-sync` | Pull Studio scripts → local files |
| `npm run blueprint:sync` | One-shot instances.json sync |
| `npm run blueprint:doctor` | Full connectivity check |
| `npm run luau:lint` | Luau static analysis |
| `npm run build` | Compile TS → dist/ |
| `npm run build:plugin` | Build Studio plugin .rbxmx |

---

## 6. Troubleshooting

| Problem | Fix |
|---------|-----|
| `pluginConnected: false` | Studio plugin not connected. Click Connect in Plugins toolbar. |
| `EADDRINUSE :58741` | MCP server already running. Kill it or use the existing one. |
| `EADDRINUSE :34872` | Rojo already running. Kill it first. |
| Place resolves to `legacy` | Run `npm run place:detect` again. |
| `"Manifest must contain an instances array"` | `instances.json` has `{}` instead of `[]`. |
| Large script writes fail | Use `push-script-fast.mjs` or chunked upload tools. |
| `set_property cannot be used for Source` | Expected — use `set_script_source` or push scripts via Rojo. |

---

*Version: 2.3.0*
