# Roblox Studio MCP: Session Playbook

This repository is an MCP bridge for Roblox Studio with an IDE-first workflow.

This README is intentionally written as an operational guide for future sessions (Codex, OpenCode, Claude, etc.) so you can get from zero to productive quickly and avoid known failure modes.

## 0) What Changed In v1.10.0

- Added `apply_and_verify_script_source` (atomic apply, verify, optional rollback).
- Added in-memory snapshot tools:
  - `create_script_snapshot`
  - `list_script_snapshots`
  - `rollback_script_snapshot`
- Added drift detection:
  - MCP tool `check_script_drift`
  - CLI helper `npm run drift:check`
- Added deprecated API linting:
  - MCP tool `lint_deprecated_apis`
  - CLI helper `npm run lint:deprecated`
- Added diagnostics:
  - `GET /diagnostics`
  - MCP tool `get_diagnostics`
  - CLI helper `npm run dev:cockpit`
- Added write idempotency support:
  - request header `X-Idempotency-Key`
  - or payload field `idempotencyKey`

## 1) What This Stack Does

- Connects MCP clients to Roblox Studio through a local plugin + local Node server.
- Supports Studio inspection and edits (scripts, properties, attributes, tags, object creation, selection, etc.).
- Supports IDE-first source control with Rojo mapping and sync helpers.
- Includes reliability/perf upgrades for large script workflows.

## 2) Current Architecture

- Studio plugin (polls MCP server): `studio-plugin/plugin.server.luau`
- MCP server runtime: `dist/index.js` (built from `src/`)
- Local HTTP status:
  - `http://localhost:3002/health`
  - `http://localhost:3002/status`
- Place-aware blueprint (preferred):
  - registry: `blueprint-v1/places/registry.json`
  - per-place project: `blueprint-v1/places/<slug>/default.project.json`
  - per-place source tree: `blueprint-v1/places/<slug>/src/`
  - per-place property manifest: `blueprint-v1/places/<slug>/properties/instances.json`
- Legacy fallback remains supported:
  - `blueprint-v1/default.project.json`
  - `blueprint-v1/src/`
  - `blueprint-v1/properties/instances.json`

## 3) First-Time Setup

1. Install plugin to Roblox plugins folder.
2. In Studio: enable **Allow HTTP Requests**.
3. Configure MCP client to run this server.
4. Start Studio, enable plugin, verify it shows connected.

### Codex config example (`~/.codex/config.toml`)

```toml
[mcp_servers.robloxstudio]
command = "node"
args = ["C:/Users/aaron/OneDrive/Desktop/rblxMCP/dist/index.js"]
```

If using npm package form, use `npx -y robloxstudio-mcp@latest` instead.

## 4) Daily Workflow (Recommended)

### A) Select place context (one time per place)

Detect current Studio place and auto-register if missing:

```powershell
npm run place:detect
```

See what context scripts will use:

```powershell
npm run place:status
npm run place:list
```

Switch active place manually:

```powershell
node scripts/places.mjs use <placeId-or-slug>
```

### B) Start services

1. Open Roblox Studio place.
2. Enable plugin (MCP panel should show connected).
3. Start server (if not already):

```powershell
node dist/index.js
```

4. Verify health:

```powershell
Invoke-RestMethod http://localhost:3002/health
```

### C) IDE-first sync

Run Rojo for script syncing (uses the selected place project automatically in `npm run dev:studio`, or run manually against `npm run place:status` project path):

```powershell
rojo serve blueprint-v1/places/<slug>/default.project.json
```

### D) Property/state sync (non-script)

One-shot:

```powershell
npm run blueprint:sync
```

Watch mode:

```powershell
npm run blueprint:watch
```

### E) Reverse sync (Studio -> files, guarded)

```powershell
npm run blueprint:reverse-sync
```

One-cycle test:

```powershell
node scripts/reverse-sync-rojo.mjs --once
```

State/conflicts:

- `blueprint-v1/places/<slug>/.reverse-sync-state.json`
- `blueprint-v1/places/<slug>/.reverse-sync-conflicts/`
- Legacy fallback (if no place mapping): `blueprint-v1/.reverse-sync-*`

## 5) Fast Script Write Strategy (Important)

Large full-source writes can be slow or hang via editor-safe APIs in some Studio/plugin states.

Use this priority order:

1. `batch_script_edits` for targeted modifications.
2. `set_script_source_checked` for safe full rewrites when content size is moderate.
3. `set_script_source_fast` for large full rewrites.
4. For guaranteed fast local pushes from this repo, use the helper script below.

### Fast local pusher (recommended for large scripts)

Script: `scripts/push-script-fast.mjs`

Examples:

```powershell
node scripts/push-script-fast.mjs --instance game.ServerScriptService.TycoonMain --file blueprint-v1/places/<slug>/src/ServerScriptService/TycoonMain.server.luau
node scripts/push-script-fast.mjs --instance game.StarterPlayer.StarterPlayerScripts.TycoonClientUI --file blueprint-v1/places/<slug>/src/StarterPlayer/StarterPlayerScripts/TycoonClientUI.client.luau
```

Why this is fast:

- Uses Node JSON serialization (avoids slow PowerShell `ConvertTo-Json` on huge payloads).
- Uses `set_script_source_fast` and auto-fallback when plugin endpoint is older.
- Supports `--gzip` to reduce payload transfer size even more:

```powershell
node scripts/push-script-fast.mjs --instance game.ServerScriptService.TycoonMain --file blueprint-v1/places/<slug>/src/ServerScriptService/TycoonMain.server.luau --gzip
```

### Apply + verify + rollback-safe push

```powershell
node scripts/apply-verify.mjs --instance game.ServerScriptService.TycoonMain --file blueprint-v1/places/<slug>/src/ServerScriptService/TycoonMain.server.luau --needle "local Players"
```

## 6) MCP Tools: Best Practices

### Safe write flow

1. `get_script_snapshot`
2. Modify source
3. `set_script_source_checked` with `expectedHash`

### Refactor flow

- For multi-change line operations: `batch_script_edits` with rollback.
- For very large rewrites: `set_script_source_fast` (or `push-script-fast.mjs`).

### Read flow

- Use `get_script_source` with ranges for huge files.
- Use snapshot/hash tooling when consistency matters.

### High-safety flow (recommended for production edits)

1. `create_script_snapshot`
2. Apply through `apply_and_verify_script_source`
3. If needed, `rollback_script_snapshot`

### Drift flow

1. Maintain script mapping list (`instancePath` -> local file).
2. Run `check_script_drift`.
3. Resolve only reported drifted files.

## 7) Performance and Reliability Notes

- Plugin polling is optimized (hot/active/idle intervals).
- Plugin reports version/capabilities on `/ready` and poll heartbeat (query fallback), so MCP can detect loaded plugin features even after staggered restarts.
- Bridge stats are exposed on `/health` and `/status`.
- Write endpoints now support idempotency keys (`X-Idempotency-Key` or `idempotencyKey` in payload) with replay cache.
- `/diagnostics` and `npm run dev:cockpit` expose readiness, recent errors, idempotency cache, and write queue status.
- If full-source writes are slow, the bottleneck is often client-side payload handling or plugin runtime version mismatch.

## 8) Troubleshooting (Exact)

### MCP says enabled but no tools / handshake errors

- Restart MCP client.
- Restart Studio.
- Re-enable plugin in Studio.
- Verify `http://localhost:3002/health` shows:
  - `pluginConnected: true`
  - `mcpServerActive: true`

### `Unknown endpoint: /api/set-script-source-fast`

- Studio is running an older loaded plugin instance.
- Rebuild/install plugin and restart Studio.

Install plugin file:

- `C:\Users\aaron\AppData\Local\Roblox\Plugins\MCPPlugin.rbxmx`

### Full-source write is taking minutes

- Do **not** use giant PowerShell JSON bodies.
- Use:
  - `node scripts/push-script-fast.mjs ...`
  - or chunked `batch_script_edits`

### Script appears truncated in reads

- Use range reads or snapshot/full-source-aware paths.
- Avoid assuming first 1000 lines are complete on legacy paths.

### Health says plugin is old version after plugin rebuild

- Studio may still be running an old loaded plugin runtime.
- Fully restart Roblox Studio after copying `studio-plugin/MCPPlugin.rbxmx`.
- Re-check `http://localhost:3002/health` and confirm `plugin.version`.

### Duplicate write requests from retries

- Use idempotency key on write calls:
  - Header: `X-Idempotency-Key: <stable-key>`
  - Payload: `idempotencyKey: "<stable-key>"`
- Replayed responses include `idempotency.replayed: true`.

## 9) Build / Test / Ship

```powershell
npm run typecheck
npm test -- --runInBand
npm run build
npm run build:plugin
```

After `build:plugin`, copy to plugins folder and restart Studio to load updated plugin code.

## 10) Future Session Checklist (Codex Self-Reminder)

At session start:

1. Check `git status`.
2. Confirm health endpoint.
3. Confirm plugin connected.
4. Run `npm run place:status` and confirm resolved project/src paths.
5. Prefer editing files in resolved `.../places/<slug>/src`.
6. Push large script updates with `scripts/push-script-fast.mjs`.
7. Verify applied markers by reading script source back from MCP.

Before ending session:

1. Run typecheck/tests if code changed.
2. Confirm scripts in Studio match repo state.
3. Summarize exact commands used for next session continuity.

## 11) Useful Commands

```powershell
# health
Invoke-RestMethod http://localhost:3002/health

# status
Invoke-RestMethod http://localhost:3002/status

# diagnostics
Invoke-RestMethod http://localhost:3002/diagnostics

# blueprint doctor
npm run blueprint:doctor

# place mapping
npm run place:detect
npm run place:list
npm run place:status
node scripts/places.mjs use <placeId-or-slug>

# dev cockpit (health/status/diagnostics/runtime snapshot)
npm run dev:cockpit

# property sync
npm run blueprint:sync
npm run blueprint:watch

# reverse sync
npm run blueprint:reverse-sync

# drift check (repeat --map)
npm run drift:check -- --map game.ServerScriptService.TycoonMain=blueprint-v1/places/<slug>/src/ServerScriptService/TycoonMain.server.luau

# deprecation lint (e.g., GetCollisionGroups)
npm run lint:deprecated

# safe apply + verify
npm run apply:verify -- --instance game.ServerScriptService.TycoonMain --file blueprint-v1/places/<slug>/src/ServerScriptService/TycoonMain.server.luau --needle "local Players"

# create/list/rollback snapshots through MCP HTTP
Invoke-RestMethod -Method Post -Uri http://localhost:3002/mcp/create_script_snapshot -ContentType application/json -Body '{"instancePath":"game.ServerScriptService.TycoonMain","label":"pre-refactor"}'
Invoke-RestMethod -Method Post -Uri http://localhost:3002/mcp/list_script_snapshots -ContentType application/json -Body '{}'
Invoke-RestMethod -Method Post -Uri http://localhost:3002/mcp/rollback_script_snapshot -ContentType application/json -Body '{"snapshotId":"ss_1","verify":true}'

# fast full script push
node scripts/push-script-fast.mjs --instance game.ServerScriptService.TycoonMain --file blueprint-v1/places/<slug>/src/ServerScriptService/TycoonMain.server.luau
```

## 12) Reference Docs

- `docs/CLIENTS.md`
- `docs/BLUEPRINT_V1.md`
- `docs/install/humans/README.md`
- `docs/install/agents/README.md`
- `studio-plugin/INSTALLATION.md`

---

If this playbook and runtime commands are followed, future sessions should be fast, reproducible, and safe for large Roblox script workflows.
