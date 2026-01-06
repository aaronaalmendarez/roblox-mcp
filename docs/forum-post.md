<div align="center">

[⭐ Star on GitHub for updates](https://github.com/boshyxd/robloxstudio-mcp)

</div>

<div align="center">

![replicate-prediction-ejzr9cgx5hrm80cqbpdsbxve1c|689x394, 75%](upload://pksmr092TG2MDid0jQCYqQcOO6M.png)

</div>

<div align="center">

[**Download**](https://github.com/boshyxd/robloxstudio-mcp/releases) | [**GitHub**](https://github.com/boshyxd/robloxstudio-mcp) | [**NPM Package**](https://www.npmjs.com/package/robloxstudio-mcp) | [**Documentation**](https://github.com/boshyxd/robloxstudio-mcp#readme)

</div>

<div align="center">

**Connect AI assistants like Claude to your Roblox Studio projects**

*37+ tools for project analysis, script editing, attributes, tags, and bulk operations*

</div>

---

## What is This?

An MCP server that connects AI assistants (like Claude) to Roblox Studio through a local bridge and plugin. It lets AI explore your game's structure, read and edit scripts (including ModuleScripts), and perform safe, bulk changes, all locally.

---

## Quick Setup

**Step 1:** Install the Studio plugin (from Releases or your preferred method)

**Step 2:** Enable "Allow HTTP Requests" in Game Settings → Security

**Step 3:** Connect your AI assistant:

```bash
# Claude Code
claude mcp add robloxstudio -- npx robloxstudio-mcp

# Claude Desktop - add to config
{
  "mcpServers": {
    "robloxstudio-mcp": {
      "command": "npx",
      "args": ["-y", "robloxstudio-mcp"]
    }
  }
}
```

Updating from older versions or fixing cache issues:
```bash
npm i robloxstudio-mcp
```

The plugin shows "Connected" when ready.

## What Can You Do?

```text
Project understanding:  "What's the structure of this game?"
Debugging:             "Find possible memory leaks or deprecated APIs"
Mass operations:       "Create 50 test NPCs and position them in a grid"
Script work:           "Explain this weapon system" / "Optimize this movement code"
Attributes & Tags:     "Tag all enemies for CollectionService" / "Set custom attributes"
```

## Why Use This?

- Understand and navigate large projects quickly
- Apply consistent changes at scale (properties, duplication, creation)
- Read and edit script sources programmatically and safely via Studio
<details>
<summary><strong>Complete Tool List (37+ tools)</strong></summary>

**Analysis & Search:** `get_project_structure`, `get_file_tree`, `get_selection`, `search_objects`, `search_files`, `search_by_property`, `get_place_info`, `get_services`

**Properties:** `get_instance_properties`, `get_instance_children`, `get_class_info`, `set_property`, `mass_set_property`, `mass_get_property`, `set_calculated_property`, `set_relative_property`

**Creation & Manipulation:** `create_object`, `create_object_with_properties`, `mass_create_objects`, `mass_create_objects_with_properties`, `delete_object`, `smart_duplicate`, `mass_duplicate`

**Scripts:** `get_script_source`, `set_script_source`, `edit_script_lines`, `insert_script_lines`, `delete_script_lines`

**Attributes:** `get_attribute`, `set_attribute`, `get_attributes`, `delete_attribute`

**Tags:** `get_tags`, `add_tag`, `remove_tag`, `get_tagged`

</details>

## Security

- 100% local: runs on your machine
- Localhost-only bridge (default: 3002)

---

## Latest Updates

### v1.9.0
- **Full HTTP API Parity** - All 37+ tools now available via both stdio MCP and HTTP endpoints
- **Lune E2E Testing** - Comprehensive Luau-based end-to-end tests (30 tests covering all endpoints)
- **Fixed Test Suite** - Resolved timeout and cleanup issues, all 32 Jest tests pass cleanly
- **Version Sync** - Plugin version now matches npm package version

### v1.8.0
- `get_selection` tool for context-aware AI assistance
- Fixed Vector3, Color3, Enum handling in property operations
- Fixed script newline corruption

### v1.7.x
- Partial script editing (`edit_script_lines`, `insert_script_lines`, `delete_script_lines`)
- Attributes and Tags (CollectionService) support
- Improved script handling with `numberedSource` field

---

## Get Started

1. **[Install Studio Plugin](https://github.com/boshyxd/robloxstudio-mcp/releases)**
2. **Enable HTTP Requests** (Game Settings → Security)
3. **Connect AI:** `claude mcp add robloxstudio -- npx -y robloxstudio-mcp`

## Links & Resources

[**Documentation**](https://github.com/boshyxd/robloxstudio-mcp#readme) • [**Report Issues**](https://github.com/boshyxd/robloxstudio-mcp/issues) • [**Request Features**](https://github.com/boshyxd/robloxstudio-mcp/issues/new) • [**NPM Package**](https://www.npmjs.com/package/robloxstudio-mcp)

---

*MIT Licensed • Free for any use • Built for the Roblox developer community*
