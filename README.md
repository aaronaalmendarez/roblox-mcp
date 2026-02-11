<p align="center">
 <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Roblox_player_icon_black.svg/200px-Roblox_player_icon_black.svg.png" alt="Roblox Studio MCP" width="80" />
</p>

<h1 align="center">Roblox Studio MCP</h1>

<p align="center">
 <strong>Model Context Protocol server for AI-powered Roblox Studio development</strong>
</p>

<p align="center">
 <a href="https://www.npmjs.com/package/@aaronalm19/roblox-mcp"><img src="https://img.shields.io/npm/v/%40aaronalm19%2Froblox-mcp?style=flat-square&color=cb3837" alt="npm version" /></a>
 <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License" /></a>
 <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square" alt="Node.js" /></a>
 <a href="https://github.com/boshyxd/robloxstudio-mcp/issues"><img src="https://img.shields.io/github/issues/boshyxd/robloxstudio-mcp?style=flat-square" alt="Issues" /></a>
</p>

<p align="center">
 <a href="#-quick-start">Quick Start</a> 
 <a href="#-features">Features</a> 
 <a href="#%EF%B8%8F-architecture">Architecture</a> 
 <a href="#-mcp-tools">Tools</a> 
 <a href="#-client-setup">Client Setup</a> 
 <a href="#-blueprint-v1">Blueprint</a> 
 <a href="#-contributing">Contributing</a>
</p>

---

## What Is This?

**Roblox Studio MCP** bridges any MCP-compatible AI assistant Claude, Gemini, Codex, OpenCode, and more directly into a running Roblox Studio session. Your AI can read the instance tree, edit scripts, set properties, manage attributes and tags, create objects, and sync source files all through a local, privacy-first connection that never leaves your machine.

## Quick Start

### 1. Install the Studio Plugin

Install the plugin manually from this repository (see below).

<details>
<summary>Alternative methods</summary>

**Direct download:**
Download [MCPPlugin.rbxmx](https://github.com/boshyxd/robloxstudio-mcp/releases/latest/download/MCPPlugin.rbxmx) and save to your plugins folder:
- **Windows:** `%LOCALAPPDATA%/Roblox/Plugins/`
- **macOS:** `~/Documents/Roblox/Plugins/`

**From source:**
```bash
npm run build:plugin
# Copy studio-plugin/MCPPlugin.rbxmx to your plugins folder
```
</details>

### 2. Enable HTTP in Studio

**Game Settings Security Allow HTTP Requests** 

### 3. Connect Your AI Client

```bash
# This fork / local harness
node dist/index.js
```


## Features

### 37+ MCP Tools

| Category | What It Does |
| ---------------------- | -------------------------------------------------------------------------- |
| **Instance Hierarchy** | Browse the full game tree, search by name/class/content, explore services |
| **Script Management** | Read, write, and edit Luau scripts with line-level precision |
| **Batch Editing** | Atomic multi-operation edits with hash checks and automatic rollback |
| **Properties** | Get/set any instance property, mass operations, formula-based calculations |
| **Object Lifecycle** | Create, delete, and smart-duplicate instances with property variations |
| **Attributes & Tags** | Full CRUD for instance attributes and CollectionService tags |
| **Diagnostics** | Drift detection, deprecated API linting, health monitoring, telemetry |
| **Snapshots** | In-memory script snapshots with rollback for safe experimentation |

### IDE-First Workflow

- **Blueprint V1** Rojo-based source control with multi-place project support
- **Bi-directional sync** Push files to Studio or pull Studio changes back to disk
- **Conflict resolution** Hash-based safeguards prevent accidental overwrites
- **Drift detection** Detect when Studio and local files have diverged

### Reliability & Performance

- Optimistic concurrency with SHA-256 hash checks
- Write idempotency (replay-safe via `X-Idempotency-Key`)
- Fast write paths for large scripts (gzip support)
- Smart plugin polling with hot/active/idle intervals
- Atomic apply-verify-rollback pipeline

## Architecture

```
 stdio HTTP 
 AI Assistant MCP Server Studio Plugin 
 (Claude, Gemini, (Node.js) localhost (Luau) 
 Codex, etc.) Port 3002 :3002 Polls for work 
 
 
 
 
 Blueprint V1 
 (Rojo project 
 + sync tools) 
 
```

| Component | Location | Purpose |
| ----------------- | -------------------- | --------------------------------------------------------------- |
| **MCP Server** | `src/` | TypeScript server implementing the MCP protocol over stdio |
| **HTTP Bridge** | `src/http-server.ts` | Express server on `:3002` bridging MCP Studio plugin |
| **Studio Plugin** | `studio-plugin/` | Luau plugin that polls the bridge and executes Studio API calls |
| **Blueprint** | `blueprint-v1/` | Rojo project trees, property manifests, and sync state |
| **CLI Scripts** | `scripts/` | 20+ helper scripts for sync, lint, push, diagnostics |

## MCP Tools

<details>
<summary><strong>Instance Hierarchy</strong> Browse and search the game tree</summary>

| Tool | Description |
| ----------------------- | ----------------------------------------------------- |
| `get_file_tree` | Get the Roblox instance hierarchy as a tree |
| `search_files` | Search instances by name, class, or script content |
| `get_services` | List available Roblox services and their children |
| `search_objects` | Find instances by name, class, or property value |
| `get_project_structure` | Get complete game hierarchy with configurable depth |
| `get_instance_children` | Get child instances and their class types |
| `get_class_info` | Get available properties/methods for any Roblox class |
| `get_place_info` | Get place ID, name, and game settings |
| `get_selection` | Get currently selected objects in Studio |
</details>

<details>
<summary><strong>Script Management</strong> Read, write, and edit Luau scripts</summary>

| Tool | Description |
| -------------------------------- | ------------------------------------------------------ |
| `get_script_source` | Read script source with optional line ranges |
| `get_script_snapshot` | Get source + SHA-256 hash for concurrency control |
| `set_script_source` | Replace entire script source (editor-safe) |
| `set_script_source_checked` | Write only if hash matches (prevents stale overwrites) |
| `set_script_source_fast` | Direct assignment for large scripts |
| `set_script_source_fast_gzip` | Gzip-compressed fast write for very large scripts |
| `edit_script_lines` | Replace specific line ranges |
| `insert_script_lines` | Insert lines at a specific position |
| `delete_script_lines` | Delete specific line ranges |
| `batch_script_edits` | Atomic multi-edit with rollback and hash check |
| `apply_and_verify_script_source` | Atomic apply verify rollback pipeline |
</details>

<details>
<summary><strong>Snapshots & Safety</strong> Rollback protection</summary>

| Tool | Description |
| -------------------------- | ----------------------------------------- |
| `create_script_snapshot` | Create an in-memory rollback point |
| `list_script_snapshots` | List all snapshots in the current session |
| `rollback_script_snapshot` | Restore source from a snapshot |
| `cancel_pending_writes` | Cancel queued write operations |
</details>

<details>
<summary><strong>Properties & Objects</strong> Modify instances and create new ones</summary>

| Tool | Description |
| ------------------------------------- | ------------------------------------------------------- |
| `get_instance_properties` | Get all properties of an instance |
| `set_property` | Set a property on any instance |
| `mass_set_property` | Set the same property on multiple instances |
| `mass_get_property` | Read the same property from multiple instances |
| `search_by_property` | Find objects with specific property values |
| `set_calculated_property` | Set properties using mathematical formulas |
| `set_relative_property` | Modify properties relative to current values |
| `create_object` | Create a new instance |
| `create_object_with_properties` | Create an instance with initial properties |
| `mass_create_objects` | Batch-create multiple instances |
| `mass_create_objects_with_properties` | Batch-create with properties |
| `delete_object` | Delete an instance |
| `smart_duplicate` | Duplicate with auto-naming, positioning, and variations |
| `mass_duplicate` | Multiple smart duplications at once |
</details>

<details>
<summary><strong>Attributes & Tags</strong> Instance metadata</summary>

| Tool | Description |
| --------------------------------- | -------------------------------------- |
| `get_attribute` / `set_attribute` | Read/write a single attribute |
| `get_attributes` | Get all attributes on an instance |
| `delete_attribute` | Remove an attribute |
| `get_tags` | Get all CollectionService tags |
| `add_tag` / `remove_tag` | Add or remove a tag |
| `get_tagged` | Find all instances with a specific tag |
</details>

<details>
<summary><strong>Diagnostics & Quality</strong> Monitor and lint</summary>

| Tool | Description |
| ---------------------- | --------------------------------------------- |
| `get_runtime_state` | Get write queue and bridge telemetry |
| `get_diagnostics` | Full diagnostics: queue, snapshots, readiness |
| `check_script_drift` | Compare local files vs Studio source hashes |
| `lint_deprecated_apis` | Scan for deprecated Roblox API usage |
</details>

## Client Setup

Works with **any MCP-compatible client**.

Local repository command (from project root):

```bash
node dist/index.js
```

Published package:

```
npx -y @aaronalm19/roblox-mcp@latest
```

<details>
<summary><strong>Claude Code</strong></summary>

```bash
claude mcp add robloxstudio -- node /absolute/path/to/roblox-mcp/dist/index.js
```
</details>

<details>
<summary><strong>Gemini CLI</strong></summary>

```bash
gemini mcp add robloxstudio node --trust -- /absolute/path/to/roblox-mcp/dist/index.js
```
</details>

<details>
<summary><strong>Claude Desktop / mcpServers JSON</strong></summary>

```json
{
 "mcpServers": {
 "robloxstudio-mcp": {
 "command": "node",
 "args": ["/absolute/path/to/roblox-mcp/dist/index.js"]
 }
 }
}
```
</details>

<details>
<summary><strong>Codex CLI</strong></summary>

`~/.codex/config.toml`:
```toml
[mcp_servers.robloxstudio]
command = "node"
args = ["/absolute/path/to/roblox-mcp/dist/index.js"]
```
</details>

<details>
<summary><strong>OpenCode</strong></summary>

`~/.config/opencode/opencode.json`:
```json
{
 "mcp": {
 "robloxstudio": {
 "type": "local",
 "enabled": true,
 "command": ["node", "/absolute/path/to/roblox-mcp/dist/index.js"]
 }
 }
}
```
</details>

<details>
<summary><strong>Windows troubleshooting</strong></summary>

If your client cannot launch `node` directly, wrap with `cmd`:
```json
{
 "command": "cmd",
 "args": ["/c", "node", "/absolute/path/to/roblox-mcp/dist/index.js"]
}
```
</details>

## Blueprint V1

Blueprint V1 is the IDE-first source control layer built on [Rojo](https://rojo.space/). It enables bi-directional sync between your local files and Roblox Studio.

### Multi-Place Projects

```
blueprint-v1/
 places/
 registry.json # Place ID slug mapping
 .active-place.json # Currently active place
 <slug>/
 default.project.json # Rojo project file
 src/ # Luau source tree
 properties/
 instances.json # Non-script property manifest
 src/ # Legacy fallback tree
```

### Key Commands

```bash
# Place management
npm run place:detect # Auto-detect and register current Studio place
npm run place:list # List all registered places
npm run place:status # Show resolved project/src paths

# Sync
npm run blueprint:sync # One-shot property sync (Studio manifest)
npm run blueprint:watch # Continuous property sync
npm run blueprint:reverse-sync # Pull Studio changes back to local files

# Quality
npm run blueprint:doctor # Connectivity diagnostics
npm run drift:check # Detect file drift between local and Studio
npm run lint:deprecated # Scan for deprecated API usage
npm run luau:lint # Luau static analysis
npm run luau:lint:strict # Strict mode analysis
```

## Development

### Prerequisites

- **Node.js** 18
- **Roblox Studio** with HTTP requests enabled
- **Rojo** (recommended, for script syncing)

### Build & Test

```bash
npm install # Install dependencies
npm run build # Compile TypeScript dist/
npm run build:plugin # Build Studio plugin .rbxmx
npm run typecheck # Type-check without emitting
npm test # Run Jest test suite
npm run luau:lint # Lint Luau source files
```

### Run Locally

```bash
npm run dev # Start with tsx (hot reload)
npm start # Start from compiled dist/
```

### Health Check

```bash
# Verify the server and plugin are connected
curl http://localhost:3002/health
curl http://localhost:3002/status
curl http://localhost:3002/diagnostics
```

### Project Structure

```
robloxstudio-mcp/
 src/ # TypeScript MCP server source
 index.ts # MCP tool definitions and request handler
 http-server.ts # Express bridge server (port 3002)
 bridge-service.ts # Plugin communication layer
 tools/ # Tool implementation modules
 studio-plugin/ # Roblox Studio Luau plugin
 plugin.server.luau # Plugin source (polls bridge for work)
 MCPPlugin.rbxmx # Built plugin file
 blueprint-v1/ # Rojo project trees and sync state
 scripts/ # CLI helper scripts (sync, lint, push, etc.)
 tests/ # Jest + Luau E2E tests
 docs/ # Additional documentation
```

## Security & Privacy

- **100% local** all communication stays on `localhost`, nothing is sent externally
- **No data collection** your projects, scripts, and Studio data remain private
- **Explicit actions only** tools run only when invoked by your MCP client
- **Read/write separation** read and write tools are distinct and intentional

## Troubleshooting

| Problem | Solution |
| ---------------------------- | ------------------------------------------------------------------------ |
| Plugin not in toolbar | Verify plugin file is in the correct plugins folder, restart Studio |
| HTTP 403 errors | Enable **Allow HTTP Requests** in Game Settings Security |
| Plugin shows disconnected | Normal when server isn't running start the MCP server |
| No tools in AI client | Restart your MCP client and Studio, check `http://localhost:3002/health` |
| Large script writes are slow | Use `set_script_source_fast` or `scripts/push-script-fast.mjs` |
| Firewall blocking | Allow `localhost:3002` through Windows Firewall |

## Additional Docs

- [Client Configurations](docs/CLIENTS.md) Setup for all supported MCP clients
- [Blueprint V1 Guide](docs/BLUEPRINT_V1.md) Deep dive into the sync system
- [Plugin Installation](studio-plugin/INSTALLATION.md) Detailed plugin setup

## Contributing

Contributions are welcome! Please open an issue or pull request on [GitHub](https://github.com/aaronaalmendarez/roblox-mcp).

```bash
# Development workflow
git clone https://github.com/aaronaalmendarez/roblox-mcp.git
cd roblox-mcp
npm install
npm run dev
```

## Acknowledgements

- Original project: [`boshyxd/robloxstudio-mcp`](https://github.com/boshyxd/robloxstudio-mcp)
- This repository extends that foundation for multi-agent workflows (Codex/OpenCode and local blueprint-first development).

## License

[MIT](LICENSE) 2025


