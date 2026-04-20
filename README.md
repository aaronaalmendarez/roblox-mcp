<div align="center">

# 🎮 Roblox Studio MCP

### Give your AI full access to Roblox Studio

[![npm](https://img.shields.io/npm/v/%40aaronalm19%2Froblox-mcp?style=for-the-badge&logo=npm&logoColor=white&label=npm&color=CB3837)](https://www.npmjs.com/package/@aaronalm19/roblox-mcp)
[![License](https://img.shields.io/badge/license-MIT-3DA639?style=for-the-badge&logo=opensourceinitiative&logoColor=white)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-417E38?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**Claude** · **Gemini** · **Codex** · **OpenCode** · *any MCP client*

[Quick Start](#-quick-start) · [Studio CLI](#-the-studio-cli) · [Features](#-features) · [Tools](#-tool-reference) · [Client Setup](#-client-setup) · [Docs](#-docs)

</div>

---

An [MCP](https://modelcontextprotocol.io/) server that connects AI assistants directly to a running Roblox Studio session. Read the instance tree, edit Luau scripts, set properties, manage attributes & tags, create objects, detect drift, and sync source files — all over a **100% local** connection that never leaves your machine.

```
  Your AI                    MCP Server                Studio Plugin
 ┌──────────┐    stdio    ┌──────────────┐   HTTP    ┌──────────────┐
 │  Claude   │◄──────────►│   Node.js    │◄─────────►│    Luau      │
 │  Gemini   │            │  port 3002   │ localhost │  polls every │
 │  Codex    │            │              │           │    500ms     │
 └──────────┘            └──────┬───────┘           └──────────────┘
                                │
                         ┌──────┴───────┐
                         │ Blueprint V1 │
                         │  Rojo sync   │
                         └──────────────┘
```

---

> ## 🤖 Using an AI Agent? (Claude Code, Cursor, etc.)
>
> **Let your AI agent set everything up for you!**
>
> ### Option 1: Copy-Paste This Prompt
>
> Just copy and paste this to your AI agent:
>
> ```
> Go to https://raw.githubusercontent.com/aaronaalmendarez/roblox-mcp/main/AGENT.md
> Read the entire file, then set up the Roblox Studio MCP on my machine. Follow all the installation steps in the "Complete Installation Guide" section.
> ```
>
> Your agent will handle cloning, building, configuring MCP, and setting up Blueprint V1 automatically.
>
> ### Option 2: Manual
>
> - **[📖 View AGENT.md on GitHub](https://github.com/aaronaalmendarez/roblox-mcp/blob/main/AGENT.md)**
> - **[📋 View Raw](https://raw.githubusercontent.com/aaronaalmendarez/roblox-mcp/main/AGENT.md)** (copy all)

---

## 🚀 Quick Start

**1 →** Install the Studio plugin ([download `.rbxmx`](https://github.com/aaronaalmendarez/roblox-mcp/releases/latest/download/MCPPlugin.rbxmx)) into your plugins folder

| OS      | Path                             |
| :------ | :------------------------------- |
| Windows | `%LOCALAPPDATA%\Roblox\Plugins\` |
| macOS   | `~/Documents/Roblox/Plugins/`    |

**2 →** In Studio: **Game Settings → Security → Allow HTTP Requests** ✅

**3 →** Start the server:

```bash
# From this repo
npm install && npm run build
node dist/index.js
```

**4 →** Configure your AI client (see [Client Setup](#-client-setup)) — done!

<details>
<summary><b>Build plugin from source</b></summary>

```bash
npm run build:plugin
# Copy studio-plugin/MCPPlugin.rbxmx → plugins folder → restart Studio
```
</details>

---

## ✨ Features

### 37+ MCP Tools

|      | Category               | What You Can Do                                                   |
| :--- | :--------------------- | :---------------------------------------------------------------- |
| 📂    | **Instance Hierarchy** | Browse game tree, search by name / class / content, list services |
| 📝    | **Script Management**  | Read, write, line-edit Luau scripts with range support            |
| ⚡    | **Batch Editing**      | Atomic multi-op edits with SHA-256 hash checks + auto-rollback    |
| 🔩    | **Properties**         | Get/set any property, mass ops, formula & relative calculations   |
| 🏗️    | **Object Lifecycle**   | Create, delete, smart-duplicate with offset grids & variations    |
| 🏷️    | **Attributes & Tags**  | Full CRUD for attributes + CollectionService tags                 |
| 🩺    | **Diagnostics**        | Drift detection, deprecated API lint, health endpoints, telemetry |
| 💾    | **Snapshots**          | In-memory script snapshots with instant rollback                  |

### IDE-First Sync

- **Blueprint V1** — [Rojo](https://rojo.space/)-based multi-place source control
- **Bi-directional** — push local files to Studio *or* pull Studio changes back
- **Conflict-safe** — hash-based guards prevent accidental overwrites
- **Drift detection** — know exactly when local and Studio have diverged

### Built for Reliability

- Optimistic concurrency via SHA-256 source hashes
- Write idempotency — replay-safe with `X-Idempotency-Key`
- Chunked script uploads for very large rewrites that exceed single MCP payload limits
- Safe bridge fallback for script writes instead of `set_property` on `Source`
- Full-source reads for large scripts automatically avoid truncated plugin responses
- Smart plugin polling: hot → active → idle intervals
- Drift checks ignore formatting-only differences by default and report both raw and normalized hashes
- Atomic **apply → verify → rollback** pipeline

---

## 🎨 The Studio CLI

One command to rule them all. A zero-dependency, cross-terminal orchestrator for your entire Roblox workflow.

```
    ____  ____  ____________  ______________  _____
   / __ \/ __ )/ ____/ __ \/  _/ ____/ __ \/ ___/
  / /_/ / __  / /   / / / // // /   / / / /\__ \
 / _, _/ /_/ / /___/ /_/ // // /___/ /_/ /___/ / 
/_/ |_/_____/\____/_____/___/\____/_____//____/
```

```bash
# One command starts everything
npm run studio -- dev

# Or pick your services
npm run studio -- mcp              # MCP server only
npm run studio -- serve            # Rojo server only
npm run studio -- dev --verbose    # See all process output
```

### What it does

| Feature | Description |
| :------ | :---------- |
| **Process Orchestration** | Spawns MCP + Rojo + Watchers + Reverse Sync with a single command |
| **PID Tracking** | Every process gets a PID file in `.studio-cli/pids/` — no orphaned `node.exe` processes |
| **Cross-Platform Kill** | `taskkill /T` on Windows, `SIGTERM` on Unix — tree-wide shutdown, no zombies |
| **Log Capture** | Background processes write timestamped logs to `.studio-cli/logs/` |
| **Health Checks** | Auto-verifies MCP (HTTP) and Rojo (TCP socket) before reporting "ready" |
| **Place Context** | Auto-resolves active place, detected Studio place, or legacy fallback |
| **Beautiful UI** | ANSI boxes, spinners, tables, and status indicators — works in any terminal |

### Commands

```bash
studio dev              # Full environment (MCP + Rojo + Watch + Reverse)
studio serve            # Rojo server only
studio mcp              # MCP server only
studio sync             # Blueprint property sync once
studio watch            # Property file watcher
studio build            # Build .rbxl via Rojo
studio lint             # Luau lint
studio place list       # Places table with active marker
studio place status     # Resolved context box
studio place use <key>  # Switch active place
studio place detect     # Auto-register current Studio place
studio status           # System dashboard with health checks
studio stop [name]      # Kill tracked process(es)
studio transcribe       # Whisper transcription
studio doctor           # Blueprint doctor
studio version          # Version + logo
```

### Global Flags

```bash
--place <key>     # Target place (slug / id / name)
--verbose         # Show process output
--json            # Machine-readable output
--dry-run         # Preview changes without applying
```

---

## 🆕 Recent Reliability Fixes

- **Large script reads are no longer silently truncated** — full-source reads now return the complete script even when the plugin would otherwise cap the response to the first 1000 lines.
- **Formatting-only drift no longer shows up as content drift** — `check_script_drift` now normalizes line endings, BOM, trailing whitespace, and trailing final newlines by default.
- **Drift output is more explicit** — diagnostics now include `comparisonMode`, `formattingOnly`, `formattingDifferences`, raw hashes/lengths, and normalized hashes/lengths.
- **Large script writes now have a safe transport** — use the chunked upload tools or `scripts/push-script-fast.mjs` for large files; they commit through the plugin bridge and `UpdateSourceAsync` instead of `set_property`.
- **`Source` writes no longer go through property tools** — `set_property` and `mass_set_property` now reject the `Source` property so escape sequences are not corrupted.
- **Server and plugin defaults are aligned around port `3002`** — current builds start on `3002` first and keep `58741` only as a legacy fallback.

Example of the expected healthy case:

```json
{
  "status": "in-sync",
  "comparisonMode": "canonical-text",
  "formattingOnly": true,
  "formattingDifferences": ["trailing-newline"],
  "rawLocalLength": 74884,
  "rawStudioLength": 74883,
  "normalizedLocalLength": 74883,
  "normalizedStudioLength": 74883
}
```

This means the raw bytes differ, but the actual script content is the same.

A real healthy verification case now looks like this:

- Full source read: `localLength: 74883`, `studioLength: 74883`
- Raw bytes can still differ by one trailing newline: `rawLocalLength: 74884`, `rawStudioLength: 74883`
- Normalized hashes then match, so the result is correctly reported as `in-sync`
- The result includes `comparisonMode`, `formattingOnly`, `formattingDifferences`, and raw vs normalized hashes/lengths

---

## 🔧 Tool Reference

<details>
<summary><b>📂 Instance Hierarchy</b> — 9 tools</summary>

| Tool                    | Description                              |
| :---------------------- | :--------------------------------------- |
| `get_file_tree`         | Instance hierarchy as a tree             |
| `search_files`          | Search by name, class, or script content |
| `get_services`          | List Roblox services and children        |
| `search_objects`        | Find by name, class, or property         |
| `get_project_structure` | Full game hierarchy (configurable depth) |
| `get_instance_children` | Children + class types                   |
| `get_class_info`        | Properties/methods for any class         |
| `get_place_info`        | Place ID, name, game settings            |
| `get_selection`         | Currently selected objects               |
</details>

<details>
<summary><b>📝 Script Management</b> — 15 tools</summary>

| Tool                             | Description                        |
| :------------------------------- | :--------------------------------- |
| `get_script_source`              | Read source (optional line range, full reads safe for large scripts)  |
| `get_script_snapshot`            | Source + SHA-256 hash with full-source recovery              |
| `set_script_source`              | Full rewrite (editor-safe; use chunked upload for very large files)         |
| `begin_script_source_upload`     | Start chunked upload session for large files |
| `append_script_source_upload_chunk` | Append one chunk to an upload session |
| `commit_script_source_upload`    | Commit an uploaded script through the plugin bridge |
| `cancel_script_source_upload`    | Discard an upload session without writing |
| `set_script_source_checked`      | Write only if hash matches         |
| `set_script_source_fast`         | Fast write with safe bridge fallback  |
| `set_script_source_fast_gzip`    | Gzip-compressed fast write         |
| `edit_script_lines`              | Replace line ranges                |
| `insert_script_lines`            | Insert at position                 |
| `delete_script_lines`            | Delete line ranges                 |
| `batch_script_edits`             | Atomic multi-edit + rollback       |
| `apply_and_verify_script_source` | Apply → verify → rollback pipeline |
</details>

<details>
<summary><b>💾 Snapshots & Safety</b> — 4 tools</summary>

| Tool                       | Description              |
| :------------------------- | :----------------------- |
| `create_script_snapshot`   | In-memory rollback point |
| `list_script_snapshots`    | List session snapshots   |
| `rollback_script_snapshot` | Restore from snapshot    |
| `cancel_pending_writes`    | Cancel queued writes     |
</details>

<details>
<summary><b>🔩 Properties & Objects</b> — 14 tools</summary>

| Tool                                  | Description                         |
| :------------------------------------ | :---------------------------------- |
| `get_instance_properties`             | All properties of an instance       |
| `set_property`                        | Set any property except `Source`    |
| `mass_set_property`                   | Set on multiple instances except `Source` |
| `mass_get_property`                   | Read from multiple instances        |
| `search_by_property`                  | Find by property value              |
| `set_calculated_property`             | Formula-based property sets         |
| `set_relative_property`               | Relative modifications              |
| `create_object`                       | Create instance                     |
| `create_object_with_properties`       | Create with initial props           |
| `mass_create_objects`                 | Batch create                        |
| `mass_create_objects_with_properties` | Batch create with props             |
| `delete_object`                       | Delete instance                     |
| `smart_duplicate`                     | Smart dup with offsets & variations |
| `mass_duplicate`                      | Multiple smart dups at once         |
</details>

<details>
<summary><b>🏷️ Attributes & Tags</b> — 7 tools</summary>

| Tool                              | Description                 |
| :-------------------------------- | :-------------------------- |
| `get_attribute` / `set_attribute` | Read/write single attribute |
| `get_attributes`                  | All attributes on instance  |
| `delete_attribute`                | Remove attribute            |
| `get_tags`                        | CollectionService tags      |
| `add_tag` / `remove_tag`          | Add or remove tag           |
| `get_tagged`                      | All instances with a tag    |
</details>

<details>
<summary><b>🩺 Diagnostics</b> — 4 tools</summary>

| Tool                   | Description                     |
| :--------------------- | :------------------------------ |
| `get_runtime_state`    | Write queue + bridge telemetry  |
| `get_diagnostics`      | Full diagnostic report          |
| `check_script_drift`   | Local vs Studio drift check with formatting normalization and raw/normalized diagnostics |
| `lint_deprecated_apis` | Deprecated API scanner          |
</details>

---

## 🔌 Client Setup

> All configs point to the **local build**. Replace the path with your actual install location.

<details open>
<summary><b>Claude Code</b></summary>

```bash
claude mcp add robloxstudio -- node /path/to/roblox-mcp/dist/index.js
```
</details>

<details>
<summary><b>Gemini CLI</b></summary>

```bash
gemini mcp add robloxstudio node --trust -- /path/to/roblox-mcp/dist/index.js
```
</details>

<details>
<summary><b>Claude Desktop / Generic JSON</b></summary>

```json
{
  "mcpServers": {
    "robloxstudio-mcp": {
      "command": "node",
      "args": ["/path/to/roblox-mcp/dist/index.js"]
    }
  }
}
```
</details>

<details>
<summary><b>Codex CLI</b></summary>

`~/.codex/config.toml`:
```toml
[mcp_servers.robloxstudio]
command = "node"
args = ["/path/to/roblox-mcp/dist/index.js"]
```
</details>

<details>
<summary><b>OpenCode</b></summary>

`~/.config/opencode/opencode.json`:
```json
{
  "mcp": {
    "robloxstudio": {
      "type": "local",
      "enabled": true,
      "command": ["node", "/path/to/roblox-mcp/dist/index.js"]
    }
  }
}
```
</details>

<details>
<summary><b>Published npm package</b></summary>

If using the published package instead of a local build:
```bash
npx -y @aaronalm19/roblox-mcp@latest
```
</details>

> **Full reference with Windows fallbacks:** [docs/CLIENTS.md](docs/CLIENTS.md)

---

## 📘 Blueprint V1

IDE-first source control built on [Rojo](https://rojo.space/) with multi-place support.

```
blueprint-v1/
├── places/
│   ├── registry.json           # Place ID → slug
│   ├── .active-place.json      # Active context
│   └── <slug>/
│       ├── default.project.json
│       ├── src/                 # Luau source
│       └── properties/
│           └── instances.json   # Non-script props
└── src/                         # Legacy fallback
```

```bash
npm run place:detect             # Auto-detect Studio place
npm run place:list               # List registered places
npm run blueprint:sync           # Property sync → Studio
npm run blueprint:watch          # Continuous sync
npm run blueprint:reverse-sync   # Pull Studio → local
npm run drift:check              # Detect file divergence
npm run luau:lint                # Static analysis (requires luau-lsp, see below)
```

### Luau Lint Setup (luau-lsp)

`npm run luau:lint` uses [luau-lsp](https://github.com/JohnnyMorganz/luau-lsp) which ships **full Roblox type stubs** — `Player`, `BasePart`, `Vector3`, `RemoteEvent`, etc. all resolve correctly under `--!strict`.

**One-time setup:**

Option A — use the bundled binary (already in this repo, v1.63.0 Windows x64):
```powershell
Expand-Archive tools\luau-lsp\luau-lsp-win64.zip -DestinationPath .tools\luau-lsp -Force
```

Option B — download the latest release for your platform:
- 👉 https://github.com/JohnnyMorganz/luau-lsp/releases/latest
- Download `luau-lsp-win64.zip` (Windows), `luau-lsp-macos.zip` (macOS), or `luau-lsp-linux.zip` (Linux)
- Extract `luau-lsp[.exe]` → `.tools/luau-lsp/luau-lsp.exe`

Then generate the Rojo sourcemap:
```bash
rojo sourcemap blueprint-v1/places/<slug>/default.project.json --output sourcemap.json
```

**Run:**
```bash
npm run luau:lint          # findings=0 is the goal
npm run luau:lint:strict   # exits non-zero if any findings (use in CI)
```

**Expected clean output:**
```
[context] Place1 (125175608517936) [place1-2]
[luau-lint] files=4 analyzer=.tools/luau-lsp/luau-lsp.exe
[luau-lint] sourcemap=sourcemap.json
[luau-lint] findings=0
```

> **Deep dive:** [docs/BLUEPRINT_V1.md](docs/BLUEPRINT_V1.md)

---

## 📋 Blueprint Operator Playbook

Everything below is the **strict operational guide** for working with Blueprint V1. Follow these steps exactly.

### 1. Canonical Windows Flow (copy-paste)

Open a terminal in the repo root and run each step in order:

```powershell
# Step 1 — Detect the place open in Studio and register it
npm run place:detect

# Step 2 — Confirm resolved paths
npm run place:status

# Step 3 — Start Rojo against the resolved project
rojo serve blueprint-v1/places/<slug>/default.project.json

# Step 4 — Start continuous property sync (separate terminal)
npm run blueprint:watch

# Step 5 — Start reverse sync guard (separate terminal)
npm run blueprint:reverse-sync
```

Or use the **one-command launcher** that does steps 3-5 automatically:

```powershell
npm run studio -- dev --place <slug>
```

Or the legacy orchestrator:

```powershell
npm run dev:studio -- --place <slug>
```

> This resolves the existing place context, then spawns the MCP server, Rojo, property watcher, and reverse-sync in parallel. It does **not** run `place:detect` — you must register the place first. Press `Ctrl+C` to stop all.

---

### 2. Required Tooling Install Matrix

| Tool             | Required                | Install (Windows)                                                                                             |
| :--------------- | :---------------------- | :------------------------------------------------------------------------------------------------------------ |
| **Node.js** ≥ 18 | ✅ Yes                   | `winget install OpenJS.NodeJS.LTS` or [nodejs.org](https://nodejs.org)                                        |
| **Rojo**         | ✅ Yes (for script sync) | `cargo install rojo` — or [download binary](https://github.com/rojo-rbx/rojo/releases) and add to `PATH`      |
| **Luau CLI**     | Optional (for lint)     | `npm run luau:install` (auto-downloads from [luau-lang releases](https://github.com/luau-lang/luau/releases)) |

<details>
<summary><b>No winget or cargo?</b></summary>

- **Node.js:** Download the `.msi` installer from [nodejs.org/en/download](https://nodejs.org/en/download)
- **Rojo:** Download `rojo.exe` from [GitHub releases](https://github.com/rojo-rbx/rojo/releases), place in a folder on your `PATH`
- **Luau:** `npm run luau:install` handles this — it downloads the correct binary for your OS into `.tools/`
</details>

---

### 3. Expected Success Output Per Step

**`npm run place:detect`**
```
✔ Detected place: Place2 (136131439760483)
✔ Registered slug: place2
✔ Set as active place
```

**`npm run place:status`**
```
Mode:       place
Place:      Place2 (136131439760483)
Slug:       place2
Project:    blueprint-v1/places/place2/default.project.json
Source:     blueprint-v1/places/place2/src
Properties: blueprint-v1/places/place2/properties/instances.json
```

**`rojo serve ...`**
```
Rojo server listening on port 34872
```

**`http://localhost:3002/health`**
```json
{
  "pluginConnected": true,
  "mcpServerActive": true,
  "plugin": { "version": "1.10.0" }
}
```

**`npm run blueprint:reverse-sync`**
```
Reverse sync active. Tracked scripts: 3
Polling every 2000ms...
```

> If any output differs from the above, stop and consult the [Troubleshooting](#-troubleshooting) table.

---

### 4. Source of Truth Rules

| Situation                                       | Who Wins               | Action                                                        |
| :---------------------------------------------- | :--------------------- | :------------------------------------------------------------ |
| You edited a `.luau` file locally               | **Local wins**         | Rojo pushes to Studio automatically                           |
| You edited a script inside Studio               | **Studio wins**        | Run `npm run blueprint:reverse-sync` to pull changes back     |
| Both sides changed the same script              | **Neither** — conflict | A conflict snapshot folder is written; you manually merge     |
| Non-script property changed in Studio           | **Studio wins**        | No automated pull — manually update `instances.json` to match |
| Non-script property changed in `instances.json` | **Local wins**         | Run `npm run blueprint:sync` to push to Studio                |
| You aren't sure what changed                    | **Check first**        | Run `npm run drift:check` to compare hashes                   |

**Golden rule:** Edit scripts in your IDE (Rojo syncs them). Edit non-script properties via `instances.json`. Only reverse-sync when you intentionally made Studio-side script changes.

---

### 5. File Naming & Path Mapping

Rojo uses file suffixes to determine the script type and instance name:

| File Suffix         | Script Type                    | Instance Name           |
| :------------------ | :----------------------------- | :---------------------- |
| `.server.luau`      | `Script` (runs on server)      | Filename without suffix |
| `.client.luau`      | `LocalScript` (runs on client) | Filename without suffix |
| `.module.luau`      | `ModuleScript` (shared)        | Filename without suffix |
| `.luau` (no suffix) | `ModuleScript`                 | Full filename           |

**Path resolution example:**

```
File:     blueprint-v1/places/place2/src/ServerScriptService/HorrorMain.server.luau
Instance: game.ServerScriptService.HorrorMain       (Script)

File:     blueprint-v1/places/place2/src/StarterPlayer/StarterPlayerScripts/HorrorClient.client.luau
Instance: game.StarterPlayer.StarterPlayerScripts.HorrorClient   (LocalScript)

File:     blueprint-v1/places/place2/src/ReplicatedStorage/HorrorConfig.module.luau
Instance: game.ReplicatedStorage.HorrorConfig        (ModuleScript)
```

> The directory path under `src/` maps directly to the Roblox service hierarchy. The `default.project.json` defines which directories map to which services.

---

### 6. Conflict Handling

When reverse-sync detects **both local and Studio changed** the same script, it writes a conflict snapshot folder instead of overwriting:

```
blueprint-v1/places/<slug>/.reverse-sync-conflicts/
└── ServerScriptService/
    └── HorrorMain.server.luau/
        ├── local.luau       # Your local version at time of conflict
        ├── studio.luau      # The Studio version that diverged
        └── meta.json        # Timestamps, hashes, instance path
```

**Recovery workflow:**

1. Open the conflict folder (e.g. `.reverse-sync-conflicts/ServerScriptService/HorrorMain.server.luau/`)
2. Compare `local.luau` (your version) vs `studio.luau` (Studio's version)
3. Manually merge the changes into the original `.luau` file in `src/`
4. Delete the conflict folder
5. Run `npm run blueprint:reverse-sync` again — it will re-baseline from the merged file

**State tracking:** Each tracked script's hashes are stored in:
```
blueprint-v1/places/<slug>/.reverse-sync-state.json
```

This file contains `lastLocalHash` and `lastStudioHash` per script. If you need to force a full re-sync, delete this file and restart reverse-sync.

---

### 7. Common Failures & Fixes

| Failure                            | Cause                                       | Fix                                                   |
| :--------------------------------- | :------------------------------------------ | :---------------------------------------------------- |
| Place resolves wrong slug          | `.active-place.json` points to old place    | `npm run place:detect` (re-detects from Studio)       |
| `rojo: command not found`          | Rojo not installed or not on PATH           | Install via `cargo install rojo` or download binary   |
| Module path mismatch               | File in wrong `src/` subdirectory           | Match directory to Roblox service name exactly        |
| HTTP 403 from plugin               | HTTP requests disabled in Studio            | Game Settings → Security → Allow HTTP Requests        |
| Stale `.active-place.json`         | Switched Studio places without re-detecting | `npm run place:detect`                                |
| `ECONNREFUSED :3002`               | MCP server not running                      | `npm run studio -- dev` or `npm run dev:studio`       |
| Reverse-sync shows 0 tracked       | No scripts match Rojo mappings              | Verify files exist in resolved `src/` path            |
| Rojo sync not updating Studio      | Rojo serving wrong project file             | Check `npm run place:status` for correct project path |
| Lint says "luau-analyze not found" | Luau CLI not installed                      | `npm run luau:install`                                |
| `blueprint:doctor` fails           | Server or plugin not connected              | Start server, open Studio, enable plugin              |

---

### 8. One-Command Dev Launcher

The **Studio CLI** is the recommended daily driver:

```powershell
npm run studio -- dev --place place2
```

Or use the legacy orchestrator:

```powershell
npm run dev:studio -- --place place2
```

Both start **all four services** in parallel:

| Service              | What It Does                                                 |
| :------------------- | :----------------------------------------------------------- |
| **MCP server**       | `node dist/index.js`                                         |
| **Rojo**             | `rojo serve blueprint-v1/places/place2/default.project.json` |
| **Property watcher** | Continuous `blueprint:watch` for non-script sync             |
| **Reverse sync**     | Guarded Studio → local pull                                  |

The CLI adds PID tracking, health checks, log capture, and a beautiful terminal UI:

```
✓ Resolved: Place2 [place2]
✓ MCP server listening on port 3002
✓ Rojo server listening on port 34872
✓ Property watcher active
✓ Reverse sync active

┌─────────────────────────────────────────────────────────────────────────┐
│  Dev Environment                                                    │
│  Project:  blueprint-v1\places\place2\default.project.json           │
│  Mode:     place                                                    │
│  Studio:   ● Press Ctrl+C to stop all                              │
└─────────────────────────────────────────────────────────────────────────┘
```

> **CLI flags:** `--no-rojo`, `--no-watch`, `--no-reverse` to disable individual services. `--verbose` to see process output.

---

### 9. Blueprint Scope Boundaries

Blueprint separates concerns cleanly between two systems:

| What                                                    | Managed By                            | Files                                                    |
| :------------------------------------------------------ | :------------------------------------ | :------------------------------------------------------- |
| **Scripts** (Luau code)                                 | **Rojo**                              | `.server.luau`, `.client.luau`, `.module.luau` in `src/` |
| **Non-script properties** (Position, Size, Color, etc.) | **Sync scripts**                      | `properties/instances.json`                              |
| **Attributes**                                          | **Sync scripts**                      | `properties/instances.json` (attributes field)           |
| **Tags**                                                | **Sync scripts**                      | `properties/instances.json` (tags field)                 |
| **Instance creation / hierarchy**                       | **Rojo** (via `default.project.json`) | `default.project.json` tree                              |

**Do NOT:**
- Edit `.luau` files through `instances.json` — Rojo handles scripts
- Create new services by adding directories without updating `default.project.json`
- Mix legacy `blueprint-v1/src/` with place-specific `blueprint-v1/places/<slug>/src/`

---

### 10. Example: Horror Game (`place2`)

A complete real-world place from this repository:

```
blueprint-v1/places/place2/
├── default.project.json              # Rojo project mapping 12 services
├── .reverse-sync-state.json          # Tracks 3 scripts with SHA-256 hashes
├── .reverse-sync-conflicts/          # Empty (no conflicts currently)
├── src/
│   ├── ServerScriptService/
│   │   └── HorrorMain.server.luau    # → game.ServerScriptService.HorrorMain (Script)
│   ├── ReplicatedStorage/
│   │   └── HorrorConfig.module.luau  # → game.ReplicatedStorage.HorrorConfig (ModuleScript)
│   └── StarterPlayer/
│       └── StarterPlayerScripts/
│           └── HorrorClient.client.luau  # → game.StarterPlayer.StarterPlayerScripts.HorrorClient (LocalScript)
└── properties/
    ├── instances.json                # Non-script property manifest (empty for now)
    └── schema.json                   # Property schema definitions
```

**Registry entry** (`blueprint-v1/places/registry.json`):
```json
{
  "136131439760483": {
    "placeId": 136131439760483,
    "gameId": 9708597637,
    "slug": "place2",
    "displayName": "Place2"
  }
}
```

**Full workflow for this place:**
```powershell
# One-time: detect and register
npm run place:detect
# → ✔ Detected place: Place2 (136131439760483), slug: place2

# Daily: start everything
npm run studio -- dev --place place2
# → MCP server, Rojo, property watcher, and reverse sync all running

# Or the legacy orchestrator:
npm run dev:studio -- --place place2

# Or manually:
rojo serve blueprint-v1/places/place2/default.project.json
npm run blueprint:watch
npm run blueprint:reverse-sync
```

---

## 🛠️ Development

```bash
npm install                      # Dependencies
npm run build                    # TypeScript → dist/
npm run build:plugin             # Build .rbxmx plugin
npm run dev                      # Dev server (tsx hot reload)
npm run typecheck                # Type-check
npm test                         # Jest suite
npm run test:all                 # Jest + Luau E2E
```

### Verify Connection

```bash
curl http://localhost:3002/health
curl http://localhost:3002/diagnostics
```

### Project Layout

```
├── src/                         # TypeScript MCP server
│   ├── index.ts                 # Tool definitions + handler
│   ├── http-server.ts           # Express bridge (:3002)
│   ├── bridge-service.ts        # Plugin comms
│   └── tools/                   # Tool implementations
├── studio-plugin/               # Luau Studio plugin
├── blueprint-v1/                # Rojo projects + sync state
├── scripts/                     # 20+ CLI helpers
├── tests/                       # Jest + Luau E2E
└── docs/                        # Additional docs
```

---

## 🔒 Security

|                  |                                                  |
| :--------------- | :----------------------------------------------- |
| **Local-only**   | All traffic stays on `localhost:3002`            |
| **No telemetry** | Zero data collection — your projects are private |
| **Explicit**     | Tools only run when your AI invokes them         |
| **Separated**    | Read and write operations are distinct           |

---

## ❓ Troubleshooting

| Problem        | Fix                                                    |
| :------------- | :----------------------------------------------------- |
| Plugin missing | `.rbxmx` in plugins folder → restart Studio            |
| HTTP 403       | Game Settings → Security → Allow HTTP Requests         |
| Disconnected   | Start the MCP server — red is normal until then        |
| No tools       | Restart MCP client + Studio, check `/health`           |
| Slow or large writes | Use chunked upload tools or `push-script-fast.mjs` |
| Firewall       | Allow `localhost:3002`                                 |

---

## 📚 Docs

|                                                      |                            |
| :--------------------------------------------------- | :------------------------- |
| [Client Configurations](docs/CLIENTS.md)             | Setup for every MCP client |
| [Blueprint V1 Guide](docs/BLUEPRINT_V1.md)           | Multi-place sync deep dive |
| [Plugin Installation](studio-plugin/INSTALLATION.md) | Detailed plugin setup      |

---

## 🤝 Contributing

```bash
git clone https://github.com/aaronaalmendarez/roblox-mcp.git
cd roblox-mcp
npm install
npm run dev
```

Issues and PRs welcome on [GitHub](https://github.com/aaronaalmendarez/roblox-mcp).

## 🙏 Acknowledgements

Original project: [`boshyxd/robloxstudio-mcp`](https://github.com/boshyxd/robloxstudio-mcp)
This fork extends that foundation for multi-agent workflows, local blueprint-first development, and enhanced tooling.

---

<div align="center">

**[MIT License](LICENSE)** © 2025

</div>
