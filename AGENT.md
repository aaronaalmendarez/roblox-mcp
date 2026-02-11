# AGENT.md - AI Agent Quick Reference

> This document is optimized for AI agents (Claude, GPT, Codex, etc.) to quickly understand and operate the Roblox Studio MCP.

---

## 🚀 FOR VIBE CODERS: Give This Entire File to Your AI Agent

If you're a developer who uses AI agents (Claude Code, Cursor, etc.) and wants to set this up automatically:

**Just copy this entire file and paste it to your AI agent with a prompt like:**
```
Read this file and set up the Roblox Studio MCP on my machine. Follow all the steps.
```

Your AI agent will handle everything - cloning the repo, installing dependencies, building, configuring MCP, and setting up Blueprint V1.

---

## Table of Contents

1. [Complete Installation Guide](#complete-installation-guide)
2. [What This Is](#what-this-is)
3. [Architecture Overview](#architecture-overview)
4. [Prerequisites Checklist](#prerequisites-checklist)
5. [Quick Setup (Copy-Paste)](#quick-setup-copy-paste)
6. [Verification Steps](#verification-steps)
7. [Blueprint V1 Setup](#blueprint-v1-setup)
8. [All MCP Tools Reference](#all-mcp-tools-reference)
9. [All NPM Scripts](#all-npm-scripts)
10. [Common Workflows](#common-workflows)
11. [Troubleshooting](#troubleshooting)
12. [File Structure](#file-structure)
13. [Best Practices](#best-practices)
14. [Luau Lint (CRITICAL)](#-critical-luau-lint-always-run-after-writing-code)

---

## Complete Installation Guide

### Repository Information
- **GitHub:** https://github.com/aaronaalmendarez/roblox-mcp
- **npm Package:** `@aaronalm19/roblox-mcp`

### Step 1: Clone the Repository

```bash
# Clone to a permanent location (not Downloads)
git clone https://github.com/aaronaalmendarez/roblox-mcp.git

# Navigate to the repo
cd roblox-mcp
```

### Step 2: Install Dependencies & Build

```bash
# Install Node.js dependencies
npm install

# Build TypeScript to JavaScript
npm run build

# Build the Roblox Studio plugin
npm run build:plugin
```

### Step 3: Install the Studio Plugin

The plugin file is located at `studio-plugin/MCPPlugin.rbxmx`. Copy it to Roblox's plugins folder:

**Windows:**
```bash
copy "studio-plugin\MCPPlugin.rbxmx" "%LOCALAPPDATA%\Roblox\Plugins\MCPPlugin.rbxmx"
```

**macOS:**
```bash
cp studio-plugin/MCPPlugin.rbxmx ~/Documents/Roblox/Plugins/MCPPlugin.rbxmx
```

**IMPORTANT:** Restart Roblox Studio after copying the plugin for it to appear.

### Step 4: Install Luau CLI (for linting)

```bash
npm run luau:install
```

This downloads the official Luau analyzer to `.tools/luau/`.

### Step 5: Install Rojo (optional, for Blueprint V1)

Rojo enables file sync between your IDE and Studio.

**Using cargo (Rust package manager):**
```bash
cargo install rojo
```

**Or download binary:**
- Go to https://github.com/rojo-rbx/rojo/releases
- Download `rojo-win64.zip` (Windows) or `rojo-macos.zip` (macOS)
- Extract and add to your PATH

### Step 6: Configure Your MCP Client

#### Claude Code
```bash
claude mcp add robloxstudio -- node /path/to/roblox-mcp/dist/index.js
```

Or use the npm package:
```bash
claude mcp add robloxstudio -- npx robloxstudio-mcp
```

#### Cursor / Windsurf / Other JSON-based clients

Add to your MCP settings file:
```json
{
  "mcpServers": {
    "robloxstudio": {
      "command": "node",
      "args": ["/path/to/roblox-mcp/dist/index.js"]
    }
  }
}
```

Or using npm:
```json
{
  "mcpServers": {
    "robloxstudio": {
      "command": "npx",
      "args": ["-y", "robloxstudio-mcp"]
    }
  }
}
```

### Step 7: Start the MCP Server

```bash
# From the repo directory
node dist/index.js

# Or using npm
npm start
```

The server runs on `localhost:3002`.

### Step 8: Connect in Roblox Studio

1. **Open Roblox Studio** and load a place
2. **Enable HTTP Requests:** Game Settings → Security → ✅ Allow HTTP Requests
3. **Activate Plugin:** Look for "MCP Server" button in Plugins toolbar
   - 🟢 Green = Connected
   - 🔴 Red = Disconnected (click to connect)

### Step 9: Verify Everything Works

```bash
# Check server health
curl http://localhost:3002/health

# Expected response:
# {"status":"ok","pluginConnected":true,"mcpServerActive":true,...}
```

### Step 10: Set Up Blueprint V1 (Optional - for file sync)

If you want to keep your `.luau` files in sync with Studio:

```bash
# Detect and register the current Studio place
npm run place:detect

# Verify place status
npm run place:status

# Start Rojo (in a separate terminal)
rojo serve blueprint-v1/places/<slug>/default.project.json

# Start the dev environment (MCP + Rojo + watchers)
npm run dev:studio -- --place <slug>
```

---

## Quick Start Checklist

After completing installation, verify each item:

- [ ] Repo cloned and built (`dist/index.js` exists)
- [ ] Plugin copied to Roblox Plugins folder
- [ ] Roblox Studio restarted
- [ ] HTTP Requests enabled in Studio
- [ ] MCP server running (`node dist/index.js`)
- [ ] Plugin shows green (connected) in Studio
- [ ] `curl http://localhost:3002/health` returns `pluginConnected: true`
- [ ] MCP client configured (Claude Code, Cursor, etc.)
- [ ] Luau CLI installed (`npm run luau:install`)
- [ ] (Optional) Rojo installed for Blueprint V1

---

## What This Is

An MCP (Model Context Protocol) server that connects AI assistants to Roblox Studio. You can:

- Read/write Luau scripts in Studio
- Create, delete, modify instances
- Get/set properties and attributes
- Sync local files with Studio via Rojo (Blueprint V1)

---

## Architecture Overview

```
┌─────────────┐      stdio       ┌─────────────────┐      HTTP       ┌─────────────────┐
│   AI Agent  │ ◄──────────────► │   MCP Server    │ ◄─────────────► │  Studio Plugin  │
│  (Claude)   │                  │  localhost:3002 │                 │   (Luau)        │
└─────────────┘                  └────────┬────────┘                 └────────┬────────┘
                                          │                                   │
                                          │                                   │
                                          ▼                                   ▼
                                 ┌─────────────────┐                 ┌─────────────────┐
                                 │  Blueprint V1   │                 │  Roblox Studio  │
                                 │  (Rojo Sync)    │                 │   Instance Tree │
                                 └─────────────────┘                 └─────────────────┘
```

**Key Points:**
- MCP Server runs on `localhost:3002`
- Studio Plugin polls server every 500ms
- Rojo syncs local `.luau` files to Studio on `localhost:34872`
- Everything is LOCAL - no external servers

---

## Prerequisites Checklist

Before starting, verify these conditions are met:

### Human Must Do (Cannot be automated):
- [ ] Roblox Studio is installed and open
- [ ] A place file is open in Studio (not just the start screen)
- [ ] **Game Settings → Security → Allow HTTP Requests** is ENABLED
- [ ] Plugin is installed (see setup below)

### System Requirements:
- [ ] Node.js >= 18
- [ ] npm
- [ ] Git
- [ ] Rojo (optional, for Blueprint V1): `cargo install rojo`

---

## Quick Setup (Copy-Paste)

### Step 1: Install Dependencies & Build

```bash
cd /path/to/rblxMCP
npm install
npm run build
```

### Step 2: Install Studio Plugin

Copy the plugin file to Roblox's plugins folder:

**Windows:**
```bash
copy "studio-plugin\MCPPlugin.rbxmx" "%LOCALAPPDATA%\Roblox\Plugins\MCPPlugin.rbxmx"
```

**macOS:**
```bash
cp studio-plugin/MCPPlugin.rbxmx ~/Documents/Roblox/Plugins/MCPPlugin.rbxmx
```

**IMPORTANT:** The user MUST restart Roblox Studio after copying the plugin.

### Step 3: Start MCP Server

```bash
node dist/index.js
```

Or use npm:
```bash
npm start
```

The server should now be running on `localhost:3002`.

### Step 4: Verify Plugin Connection

In Studio, look for the "MCP Server" button in the Plugins toolbar:
- 🟢 Green = Connected
- 🔴 Red = Disconnected (normal if server not running yet)

Click the button to toggle connection if needed.

---

## Verification Steps

### 1. Check Server Health

```bash
curl http://localhost:3002/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "service": "robloxstudio-mcp",
  "pluginConnected": true,
  "mcpServerActive": true,
  "uptime": <seconds>
}
```

**CRITICAL:** Both `pluginConnected` and `mcpServerActive` MUST be `true`. If not:
- Plugin not connected → Studio not open, plugin not installed, or HTTP requests disabled
- Server not active → Server not started

### 2. Test MCP Tool

Call `get_place_info` via MCP:
```json
{
  "name": "get_place_info",
  "arguments": {}
}
```

Should return place name and workspace info.

### 3. Run Blueprint Doctor (if using Blueprint V1)

```bash
npm run blueprint:doctor
```

Should show all green checkmarks.

---

## Blueprint V1 Setup

Blueprint V1 is the file-sync layer using Rojo. It keeps local `.luau` files in sync with Studio.

### Directory Structure

```
blueprint-v1/
├── places/
│   ├── registry.json              # Place ID → slug mapping
│   ├── .active-place.json         # Current active place
│   └── <slug>/                    # One folder per place
│       ├── default.project.json   # Rojo project config
│       ├── src/                   # Your .luau source files
│       │   ├── ServerScriptService/
│       │   │   └── MyScript.server.luau
│       │   ├── ReplicatedStorage/
│       │   │   └── MyModule.module.luau
│       │   └── StarterPlayer/
│       │       └── StarterPlayerScripts/
│       │           └── MyClient.client.luau
│       └── properties/
│           ├── instances.json     # Non-script properties (MUST be array: [])
│           └── schema.json        # Property schema
```

### File Naming Convention

| File Suffix | Script Type | Example |
|-------------|-------------|---------|
| `.server.luau` | Script (server-side) | `Main.server.luau` |
| `.client.luau` | LocalScript (client-side) | `GUI.client.luau` |
| `.module.luau` | ModuleScript | `Config.module.luau` |

### Blueprint Setup Steps

**Step 1: Detect & Register Place**

```bash
npm run place:detect
```

This queries Studio for the current place ID and creates the mapping.

**Expected Output:**
```
Detected place: PlaceName (1234567890)
Registered mapping: PlaceName [placename]
Active place updated.
```

**Step 2: Verify Place Status**

```bash
npm run place:status
```

**Expected Output:**
```
Mode: place
Detected Studio place: PlaceName (1234567890)
Active selection: PlaceName (1234567890) [placename]
Resolved place: PlaceName (1234567890) [placename]
Project: blueprint-v1\places\placename\default.project.json
Properties: blueprint-v1\places\placename\properties\instances.json
Source root: blueprint-v1\places\placename\src
```

**IMPORTANT:** If Mode shows `legacy`, the place wasn't properly registered. Re-run `npm run place:detect`.

**Step 3: Create Project Structure (if not exists)**

If the place folder doesn't exist, create it:

```bash
# Create directories
mkdir -p blueprint-v1/places/<slug>/src/ServerScriptService
mkdir -p blueprint-v1/places/<slug>/src/ReplicatedStorage
mkdir -p blueprint-v1/places/<slug>/src/StarterPlayer/StarterPlayerScripts
mkdir -p blueprint-v1/places/<slug>/properties

# Create instances.json (MUST be an array, not object!)
echo '{"$schema": "./schema.json", "instances": []}' > blueprint-v1/places/<slug>/properties/instances.json

# Create default.project.json (Rojo config)
```

**CRITICAL:** `instances.json` MUST have `"instances": []` as an **array**, not an object `{}`. The sync script will fail with "Manifest must contain an instances array" if you use `{}`.

**Step 4: Start Rojo**

```bash
rojo serve blueprint-v1/places/<slug>/default.project.json
```

Rojo runs on `localhost:34872` by default.

**Step 5: Start Property Watcher (optional)**

```bash
npm run blueprint:watch
```

This watches `instances.json` for changes and syncs to Studio.

**Step 6: Start Reverse Sync (optional)**

```bash
npm run blueprint:reverse-sync
```

This pulls Studio-side script changes back to local files.

### One-Command Dev Environment

```bash
npm run dev:studio -- --place <slug>
```

This starts:
- MCP Server
- Rojo
- Property Watcher
- Reverse Sync

**Note:** This will fail if port 3002 or 34872 is already in use. Kill existing processes first.

---

## All MCP Tools Reference

### Instance Hierarchy (9 tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `get_file_tree` | Get instance hierarchy as tree | `path` (optional, defaults to game root) |
| `get_project_structure` | Full game hierarchy | `maxDepth`, `scriptsOnly`, `path` |
| `get_services` | List all Roblox services | `serviceName` (optional) |
| `get_instance_children` | Get children of an instance | `instancePath` (e.g., "game.Workspace") |
| `get_instance_properties` | Get all properties | `instancePath` |
| `get_class_info` | Get class methods/properties | `className` |
| `get_place_info` | Place ID, name, settings | (no params) |
| `get_selection` | Currently selected objects | (no params) |
| `search_files` | Search by name/class/content | `query`, `searchType` ("name"/"type"/"content") |
| `search_objects` | Find by name/class/property | `query`, `searchType`, `propertyName` |

### Script Management (11 tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `get_script_source` | Read script source | `instancePath`, `startLine`, `endLine` |
| `get_script_snapshot` | Source + SHA-256 hash | `instancePath` |
| `set_script_source` | Full script rewrite | `instancePath`, `source` |
| `set_script_source_checked` | Hash-verified write | `instancePath`, `source`, `expectedHash` |
| `set_script_source_fast` | Direct assignment | `instancePath`, `source` |
| `set_script_source_fast_gzip` | Compressed fast write | `instancePath`, `compressedSource` |
| `edit_script_lines` | Replace line range | `instancePath`, `startLine`, `endLine`, `newContent` |
| `insert_script_lines` | Insert at position | `instancePath`, `afterLine`, `newContent` |
| `delete_script_lines` | Delete line range | `instancePath`, `startLine`, `endLine` |
| `batch_script_edits` | Atomic multi-edit | `edits[]` with path, operations |
| `apply_and_verify_script_source` | Apply → verify → rollback | `instancePath`, `source` |

### Snapshots & Safety (4 tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `create_script_snapshot` | Create rollback point | `instancePath` |
| `list_script_snapshots` | List all snapshots | `instancePath` |
| `rollback_script_snapshot` | Restore from snapshot | `instancePath`, `snapshotId` |
| `cancel_pending_writes` | Cancel queued writes | (no params) |

### Properties & Objects (14 tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `set_property` | Set single property | `instancePath`, `propertyName`, `propertyValue` |
| `mass_set_property` | Set on multiple instances | `paths[]`, `propertyName`, `propertyValue` |
| `mass_get_property` | Get from multiple instances | `paths[]`, `propertyName` |
| `search_by_property` | Find by property value | `propertyName`, `propertyValue` |
| `set_calculated_property` | Formula-based set | `paths[]`, `propertyName`, `formula`, `variables` |
| `set_relative_property` | Relative modification | `paths[]`, `propertyName`, `operation`, `value`, `component` |
| `create_object` | Create instance | `className`, `parent`, `name` |
| `create_object_with_properties` | Create with props | `className`, `parent`, `name`, `properties` |
| `mass_create_objects` | Batch create | `objects[]` |
| `mass_create_objects_with_properties` | Batch create with props | `objects[]` |
| `delete_object` | Delete instance | `instancePath` |
| `smart_duplicate` | Dup with offsets/variations | `instancePath`, `count`, `options` |
| `mass_duplicate` | Multiple smart dups | `duplications[]` |

### Attributes & Tags (7 tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `get_attribute` | Get single attribute | `instancePath`, `attributeName` |
| `set_attribute` | Set attribute | `instancePath`, `attributeName`, `attributeValue`, `valueType` |
| `get_attributes` | Get all attributes | `instancePath` |
| `delete_attribute` | Remove attribute | `instancePath`, `attributeName` |
| `get_tags` | Get CollectionService tags | `instancePath` |
| `add_tag` | Add tag | `instancePath`, `tagName` |
| `remove_tag` | Remove tag | `instancePath`, `tagName` |
| `get_tagged` | Get instances with tag | `tagName` |

### Diagnostics (4 tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `get_runtime_state` | Write queue + telemetry | (no params) |
| `get_diagnostics` | Full diagnostic report | (no params) |
| `check_script_drift` | Local vs Studio hash | `instancePath`, `localHash` |
| `lint_deprecated_apis` | Deprecated API scanner | `instancePath` |

---

## All NPM Scripts

```json
{
  "build": "tsc",
  "build:plugin": "node scripts/build-plugin.mjs",
  "build:all": "npm run build && npm run build:plugin",

  "place:detect": "Detect & register current Studio place",
  "place:status": "Show resolved paths for current place",
  "place:list": "List all registered places",

  "blueprint:doctor": "Verify full connectivity",
  "blueprint:sync": "One-shot: instances.json → Studio",
  "blueprint:watch": "Continuous property sync",
  "blueprint:reverse-sync": "Pull Studio → local files",

  "push:fast": "Fast script push",
  "push:diff": "Diff-based script push",
  "apply:verify": "Atomic apply → verify → rollback",

  "drift:check": "Detect local/Studio divergence",
  "lint:deprecated": "Scan for deprecated APIs",

  "luau:install": "Install Luau CLI",
  "luau:lint": "Luau static analysis",
  "luau:lint:strict": "Strict lint (fails on findings)",

  "dev:studio": "Start MCP + Rojo + watchers",
  "dev": "Dev server with hot reload",
  "start": "Run MCP server"
}
```

---

## Common Workflows

### Workflow 1: Read Studio State

```
1. get_place_info → Confirm connected to correct place
2. get_project_structure → See overall hierarchy
3. get_instance_children → Drill into specific services
4. get_script_source → Read specific scripts
```

### Workflow 2: Create a New Script

**Option A: Direct to Studio (no Blueprint)**
```
1. create_object(className: "Script", parent: "game.ServerScriptService", name: "MyScript")
2. set_script_source(instancePath: "game.ServerScriptService.MyScript", source: <code>)
```

**Option B: Via Blueprint V1 (recommended)**
```
1. Create file: blueprint-v1/places/<slug>/src/ServerScriptService/MyScript.server.luau
2. Write Luau code to file
3. Rojo auto-syncs to Studio
```

### Workflow 3: Edit Existing Script

**For small changes:**
```
1. get_script_source → Read current source, note line numbers
2. edit_script_lines → Replace specific lines
```

**For large rewrites:**
```
1. get_script_snapshot → Get current hash
2. set_script_source_checked → Write with hash verification (prevents race conditions)
```

### Workflow 4: Create Multiple Objects

```
1. mass_create_objects_with_properties({
     objects: [
       {className: "Part", parent: "game.Workspace", name: "Part1", properties: {Size: [4,4,4]}},
       {className: "Part", parent: "game.Workspace", name: "Part2", properties: {Size: [4,4,4]}}
     ]
   })
```

### Workflow 5: Sync Studio Changes Back to Local

```
1. npm run blueprint:reverse-sync
2. Check for conflicts in .reverse-sync-conflicts/
3. Manually merge if needed
```

---

## Troubleshooting

### Problem: `pluginConnected: false`

**Causes:**
1. Studio not open
2. Plugin not installed
3. HTTP Requests disabled
4. Plugin disabled in Studio

**Solutions:**
```bash
# 1. Verify plugin file exists
ls "%LOCALAPPDATA%\Roblox\Plugins\MCPPlugin.rbxmx"

# 2. In Studio: Game Settings → Security → Allow HTTP Requests = ON

# 3. Restart Studio completely (not just the place)
```

### Problem: `EADDRINUSE: address already in use 0.0.0.0:3002`

**Cause:** MCP server already running

**Solution:**
```bash
# Windows
netstat -ano | findstr :3002
taskkill //PID <pid> //F

# macOS/Linux
lsof -i :3002
kill -9 <pid>
```

### Problem: `EADDRINUSE: address already in use 127.0.0.1:34872`

**Cause:** Rojo already running

**Solution:**
```bash
# Windows
netstat -ano | findstr :34872
taskkill //PID <pid> //F

# macOS/Linux
lsof -i :34872
kill -9 <pid>
```

### Problem: Place resolves to "legacy" mode

**Cause:** Place not properly registered

**Solution:**
```bash
npm run place:detect
npm run place:status  # Should show Mode: place
```

### Problem: "Manifest must contain an instances array"

**Cause:** `instances.json` has `"instances": {}` instead of `"instances": []`

**Solution:**
```bash
# Fix instances.json
echo '{"$schema": "./schema.json", "instances": []}' > blueprint-v1/places/<slug>/properties/instances.json
```

### Problem: "No tracked script files found from project mapping"

**Cause:** No `.luau` files in `src/` directory yet

**Solution:** This is normal for new projects. Create at least one `.luau` file to track.

### Problem: Rojo crashes on start

**Cause:** `default.project.json` is malformed or missing

**Solution:** Ensure project file exists and is valid JSON:
```bash
cat blueprint-v1/places/<slug>/default.project.json
```

### Problem: Script changes not syncing to Studio

**Causes:**
1. Rojo not running
2. Wrong project file
3. File in wrong directory

**Solutions:**
```bash
# 1. Verify Rojo is running
curl http://localhost:34872/

# 2. Check correct project is being served
npm run place:status  # Shows resolved project path

# 3. Verify file is in correct src/ subdirectory
ls blueprint-v1/places/<slug>/src/ServerScriptService/
```

---

## File Structure

```
rblxMCP/
├── dist/                          # Compiled MCP server
│   └── index.js                   # Main entry point
├── src/                           # TypeScript source
├── studio-plugin/
│   ├── MCPPlugin.rbxmx           # Studio plugin (copy to Plugins folder)
│   └── plugin.server.luau        # Plugin source
├── scripts/                       # CLI utilities
│   ├── places.mjs                # Place management
│   ├── sync-roblox-properties.mjs
│   ├── watch-roblox-properties.mjs
│   ├── reverse-sync-rojo.mjs
│   ├── push-script-fast.mjs
│   └── ...
├── blueprint-v1/                  # File sync layer
│   └── places/
│       ├── registry.json
│       ├── .active-place.json
│       └── <slug>/
│           ├── default.project.json
│           ├── src/
│           └── properties/
├── docs/
│   ├── BLUEPRINT_V1.md
│   ├── CLIENTS.md
│   └── install/
│       ├── agents/README.md
│       └── humans/README.md
├── package.json
├── README.md
└── AGENT.md                       # This file
```

---

## Best Practices

### 1. Always Verify Before Writing

```bash
npm run blueprint:doctor  # Check connectivity
npm run place:status      # Confirm correct place
curl http://localhost:3002/health  # Quick health check
```

### 2. Use Hash-Checked Writes for Scripts

Prefer `set_script_source_checked` over `set_script_source` to prevent race conditions:

```
1. get_script_snapshot → Get current hash
2. set_script_source_checked(expectedHash: <hash>) → Write only if unchanged
```

### 3. Use Batch Operations

For multiple changes, prefer batch tools:
- `batch_script_edits` instead of multiple `edit_script_lines`
- `mass_set_property` instead of multiple `set_property`
- `mass_create_objects` instead of multiple `create_object`

### 4. Create Snapshots Before Major Changes

```
1. create_script_snapshot → Rollback point
2. Make changes
3. If something goes wrong: rollback_script_snapshot
```

### 5. Use Blueprint V1 for Persistent Projects

For anything more than quick prototypes:
- Keep `.luau` files in `blueprint-v1/places/<slug>/src/`
- Let Rojo handle sync
- Use `instances.json` for non-script properties

### 6. Handle Port Conflicts Gracefully

Before starting services, check if ports are in use:
```bash
# Windows
netstat -ano | findstr ":3002 :34872"

# Kill if needed
taskkill //PID <pid> //F
```

### 7. Read Before Edit

Always call `get_script_source` before editing to understand current state and get accurate line numbers.

---

## ⚠️ CRITICAL: Luau Lint (Always Run After Writing Code)

**Luau lint is MANDATORY for all code changes.** It catches type errors, unused variables, and potential bugs before they cause runtime issues.

### First-Time Setup

```bash
npm run luau:install
```

This downloads the official Luau CLI (luau-analyze) to `.tools/luau/`.

### Run Lint

```bash
# Standard lint
npm run luau:lint

# Strict mode (fails on any findings - use in CI)
npm run luau:lint:strict
```

### Lint Output Example

```
[context] Place1 (0) [place1]
[luau-lint] files=3 batches=1 analyzer=.tools/luau/current/win32/luau-analyze.exe
C:/path/to/file.luau:10:7-15: (W0) LocalUnused: Variable 'myVar' is never used
[luau-lint] findings=1 suppressed=150
```

### Common Lint Errors and Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Unknown global 'tick'` | `tick` not in Roblox allowlist | Use `os.clock()` instead |
| `Unknown global 'XXX'` | Global not recognized | Add to allowlist or define locally |
| `LocalUnused: Variable 'X'` | Variable declared but not used | Prefix with `_` (e.g., `_unusedVar`) |
| `TypeError` | Type mismatch or unknown type | Fix the type or add type annotation |

### Fixing Unused Variables

```lua
-- BAD: Will trigger lint warning
local SoundService = game:GetService("SoundService")  -- never used

-- GOOD: Prefix with underscore
local _SoundService = game:GetService("SoundService")
```

### Fixing `tick()` Usage

```lua
-- BAD: tick() not in allowlist
local now = tick()

-- GOOD: Use os.clock()
local now = os.clock()
```

### Roblox Globals Allowlist

The lint script automatically suppresses warnings for these Roblox globals:
- `game`, `workspace`, `script`, `task`
- `Instance`, `Enum`, `Vector2`, `Vector3`, `CFrame`
- `UDim`, `UDim2`, `Color3`, `ColorSequence`
- `TweenInfo`, `warn`, `print`

**Note:** `tick` is NOT in the allowlist. Use `os.clock()` instead.

### Lint Workflow

```
1. Write/modify .luau files
2. Run: npm run luau:lint
3. Fix ALL findings (findings must be 0)
4. Only then push to Studio or commit
```

### Mandatory Checklist Before Committing

- [ ] `npm run luau:lint` shows `findings=0`
- [ ] No type errors
- [ ] No unused variables (or prefixed with `_`)
- [ ] All Roblox globals are recognized or suppressed

---

## Quick Reference Card

```bash
# Start everything
npm run build && node dist/index.js &

# Check health
curl http://localhost:3002/health

# Setup Blueprint
npm run place:detect
npm run place:status
rojo serve blueprint-v1/places/<slug>/default.project.json &
npm run blueprint:watch &

# Verify
npm run blueprint:doctor

# Create a script file
# blueprint-v1/places/<slug>/src/ServerScriptService/Main.server.luau

# Sync Studio → Local
npm run blueprint:reverse-sync
```

---

## MCP Tool Call Examples

### Get Place Info
```json
{
  "name": "get_place_info",
  "arguments": {}
}
```

### Get Workspace Children
```json
{
  "name": "get_instance_children",
  "arguments": {
    "instancePath": "game.Workspace"
  }
}
```

### Read a Script
```json
{
  "name": "get_script_source",
  "arguments": {
    "instancePath": "game.ServerScriptService.MainScript"
  }
}
```

### Edit Script Lines (replace lines 5-10)
```json
{
  "name": "edit_script_lines",
  "arguments": {
    "instancePath": "game.ServerScriptService.MainScript",
    "startLine": 5,
    "endLine": 10,
    "newContent": "-- New code here\nprint(\"Hello\")"
  }
}
```

### Create a Part
```json
{
  "name": "create_object_with_properties",
  "arguments": {
    "className": "Part",
    "parent": "game.Workspace",
    "name": "MyPart",
    "properties": {
      "Size": {"X": 4, "Y": 4, "Z": 4},
      "Position": {"X": 0, "Y": 10, "Z": 0},
      "Anchored": true,
      "BrickColor": "Bright red"
    }
  }
}
```

### Set a Property
```json
{
  "name": "set_property",
  "arguments": {
    "instancePath": "game.Workspace.MyPart",
    "propertyName": "Transparency",
    "propertyValue": 0.5
  }
}
```

### Create a Script
```json
{
  "name": "create_object",
  "arguments": {
    "className": "Script",
    "parent": "game.ServerScriptService",
    "name": "GameLoop"
  }
}
```

Then set source:
```json
{
  "name": "set_script_source",
  "arguments": {
    "instancePath": "game.ServerScriptService.GameLoop",
    "source": "-- Game Loop\nlocal Players = game:GetService(\"Players\")\n\nprint(\"Server started!\")"
  }
}
```

---

*Last updated: 2025-02-11*
*Version: 1.10.0*
