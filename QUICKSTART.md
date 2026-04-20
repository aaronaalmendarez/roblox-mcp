# AI Agent Quickstart — rblxMCP

> **Purpose:** A concise cheat-sheet so AI agents (and humans) can immediately
> orient themselves in this project without rediscovering the setup every session.

---

## 1. Project Overview

| Item | Value |
|------|-------|
| **Repo root** | `c:\Users\aaron\OneDrive\Desktop\rblxMCP` |
| **Stack** | Roblox Studio + MCP Server (Node/TS) + Blueprint V1 (Rojo) + Luau |
| **MCP port** | `localhost:58741` (auto-discovery 58741–58745) |
| **Rojo port** | `localhost:34872` |
| **Luau linter** | `.tools/luau-lsp/luau-lsp.exe` via `scripts/luau-lint.mjs` |
| **Plugin** | `studio-plugin/MCPPlugin.rbxmx` → `%LOCALAPPDATA%\Roblox\Plugins\` |

---

## 2. Registered Places

Places live under `blueprint-v1/places/<slug>/`. The active place is tracked in
`blueprint-v1/places/.active-place.json`.

| Slug | Display Name | Place ID |
|------|-------------|----------|
| `ta4` | Tusk Act 4 | 118279409372030 |
| `horror` | Horror | 85915000064125 |
| `place1-2` | Place1 | 125175608517936 |
| `brainrot` | Place2 | 106571941339581 |
| `gacha-titles` | Gacha Titles | 126469112336825 |
| `japanese-horror` | Japanese Horror | 95715171009660 |

**To find the currently open place in Studio:**
```bash
# Option A — MCP tool
mcp_robloxstudio-mcp_get_place_info
# Returns placeId, placeName, etc.

# Option B — execute_luau
mcp_robloxstudio-mcp_execute_luau  code="return game.PlaceId .. ' / ' .. game.Name"
```

---

## 3. Session Bootstrap Checklist

Do these **in order** when starting a new coding session:

```
1. Confirm Studio is open with the correct place loaded.
2. Confirm Rojo is running:
     rojo serve blueprint-v1/places/<slug>/default.project.json
   (check terminal — should say "Rojo server listening on port 34872")
3. Confirm Rojo plugin is connected in Studio (Plugins toolbar → Rojo → Connect).
4. Identify the active place slug — read blueprint-v1/places/.active-place.json
   or call mcp get_place_info and match placeId to registry.json.
5. Read the relevant source files BEFORE editing:
     blueprint-v1/places/<slug>/src/ServerScriptService/   ← server scripts
     blueprint-v1/places/<slug>/src/StarterPlayer/StarterPlayerScripts/ ← client scripts
     blueprint-v1/places/<slug>/src/ReplicatedStorage/     ← shared modules / configs
```

---

## 4. File Naming Conventions

| Suffix | Script Type | Example |
|--------|------------|---------|
| `.server.luau` | Script (runs on server) | `EchoesServer.server.luau` |
| `.client.luau` | LocalScript (runs on client) | `EchoesClient.client.luau` |
| `.luau` | ModuleScript (shared) | `EchoesConfig.luau` |

> ⚠️ **Never** use `.module.luau` — Rojo does NOT strip `.module` from the name.

---

## 5. Editing Workflow (Golden Path)

```
1. Edit the LOCAL .luau file on disk.
   → Rojo auto-syncs to Studio within seconds.
2. Do NOT use MCP set_script_source / create_object for scripts managed by Rojo.
   → Use MCP only for geometry (Parts, RemoteEvents, Folders, etc.).
3. If Rojo is NOT running, you can manually push:
     node scripts/push-script-fast.mjs \
       --instance game.ServerScriptService.EchoesServer \
       --file blueprint-v1/places/ta4/src/ServerScriptService/EchoesServer.server.luau
```

---

## 6. Luau Lint (ALWAYS run after edits)

```bash
npm run luau:lint
```

Expected clean output:
```
[luau-lint] findings=0
```

### Common fixes

| Lint error | Fix |
|-----------|-----|
| `Unknown global 'tick'` | Use `os.clock()` |
| `LocalUnused: Variable 'X'` | Prefix with `_` → `_X` |
| `TypeError: Unknown require` | IDE-only issue with cross-place paths; runtime works fine |

---

## 7. Key npm Scripts

| Command | What it does |
|---------|-------------|
| `npm run build` | Compile TS → `dist/` |
| `npm run build:plugin` | Build Studio plugin `.rbxmx` |
| `npm run luau:lint` | Luau static analysis |
| `npm run place:detect` | Detect + register the open Studio place |
| `npm run place:status` | Show resolved paths for active place |
| `npm run blueprint:doctor` | Full connectivity check |
| `npm run blueprint:reverse-sync` | Pull Studio scripts → local files |
| `npm run dev:studio -- --place <slug>` | Start MCP + Rojo + watchers |

---

## 8. MCP Tools Cheat-Sheet

### Orientation (run first)
```
get_place_info          → place name, ID, workspace info
get_project_structure   → full game hierarchy (use maxDepth=5+)
get_services            → list all Roblox services
```

### Read scripts
```
get_script_source       → full source (use startLine/endLine for large files)
get_script_snapshot     → source + SHA-256 hash (for checked writes)
```

### Write scripts (only if NOT using Rojo)
```
set_script_source       → full rewrite
edit_script_lines       → replace specific line range
insert_script_lines     → insert at position
delete_script_lines     → remove lines
```

### Execute arbitrary Luau in Studio
```
execute_luau            → run code in plugin context, returns result
                           Use for: finding place name, debugging, creating
                           non-script instances, reading properties at runtime
```

### Create instances (geometry, events, folders — NOT scripts when Rojo is active)
```
create_object           → basic instance
create_object_with_properties → instance + initial props
```

---

## 9. Common Pitfalls Learned

1. **Don't call `execute_luau` to find the place name every time.** Read
   `blueprint-v1/places/.active-place.json` or `registry.json` instead.
2. **Rojo owns the script tree.** Never `create_object("Script")` via MCP when
   Rojo is active — it causes duplicates.
3. **`TypeError: Unknown require` lint errors** for cross-place config paths are
   IDE-only; they do not affect runtime.
4. **ModuleScript files** should end in `.luau`, NOT `.module.luau`.

---

*Last updated: 2026-03-20*
