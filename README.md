<div align="center">

# 🎮 Roblox Studio MCP

### Give your AI full access to Roblox Studio

[![npm](https://img.shields.io/npm/v/%40aaronalm19%2Froblox-mcp?style=for-the-badge&logo=npm&logoColor=white&label=npm&color=CB3837)](https://www.npmjs.com/package/@aaronalm19/roblox-mcp)
[![License](https://img.shields.io/badge/license-MIT-3DA639?style=for-the-badge&logo=opensourceinitiative&logoColor=white)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-417E38?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**Claude** · **Gemini** · **Codex** · **OpenCode** · *any MCP client*

[Quick Start](#-quick-start) · [Features](#-features) · [Tools](#-tool-reference) · [Client Setup](#-client-setup) · [Docs](#-docs)

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

## 🚀 Quick Start

**1 →** Install the Studio plugin ([download `.rbxmx`](https://github.com/boshyxd/robloxstudio-mcp/releases/latest/download/MCPPlugin.rbxmx)) into your plugins folder

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
- Fast write paths for large scripts (optional gzip compression)
- Smart plugin polling: hot → active → idle intervals
- Atomic **apply → verify → rollback** pipeline

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
<summary><b>📝 Script Management</b> — 11 tools</summary>

| Tool                             | Description                        |
| :------------------------------- | :--------------------------------- |
| `get_script_source`              | Read source (optional line range)  |
| `get_script_snapshot`            | Source + SHA-256 hash              |
| `set_script_source`              | Full rewrite (editor-safe)         |
| `set_script_source_checked`      | Write only if hash matches         |
| `set_script_source_fast`         | Direct assignment (large scripts)  |
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
| `set_property`                        | Set any property                    |
| `mass_set_property`                   | Set on multiple instances           |
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
| `check_script_drift`   | Local vs Studio hash comparison |
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
npm run luau:lint                # Static analysis
```

> **Deep dive:** [docs/BLUEPRINT_V1.md](docs/BLUEPRINT_V1.md)

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
| Slow writes    | Use `set_script_source_fast` or `push-script-fast.mjs` |
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
