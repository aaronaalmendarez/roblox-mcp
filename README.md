# Roblox Studio MCP Server

MCP server for AI-powered Roblox Studio integration. 18 specialized tools for exploring projects, analyzing scripts, and performing bulk operations.

<a href="https://glama.ai/mcp/servers/@boshyxd/robloxstudio-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@boshyxd/robloxstudio-mcp/badge" alt="Roblox Studio Server MCP server" />
</a>

## Quick Start

**For Claude Code users:**
```bash
claude mcp add robloxstudio -- npx -y robloxstudio-mcp
```

**For other MCP clients (Claude Desktop, etc.):**
```json
{
  "mcpServers": {
    "robloxstudio-mcp": {
      "command": "npx",
      "args": ["-y", "robloxstudio-mcp"],
      "description": "Advanced Roblox Studio integration for AI assistants"
    }
  }
}
```

<details>
<summary>Note for native Windows users</summary>
If you encounter issues, you may need to run it through `cmd`. Update your configuration like this:

```json
{
  "mcpServers": {
    "robloxstudio-mcp": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "robloxstudio-mcp@latest"]
    }
  }
}
```
</details>

## Studio Plugin Setup (Required)

The MCP server requires a companion Roblox Studio plugin:

   - Download [MCPPlugin.rbxmx](https://github.com/boshyxd/robloxstudio-mcp/releases/latest/download/MCPPlugin.rbxmx)
   - Save to your `%LOCALAPPDATA%/Roblox/Plugins` folder

**After installation:**
- Enable "Allow HTTP Requests" in Game Settings > Security
- Click the "MCP Server" button in the Plugins toolbar
- Status should show "Connected" when working

## Architecture Overview

Dual-component system bridging Roblox Studio with AI assistants:

```mermaid
%%{init: {'theme':'dark', 'themeVariables': {'primaryColor':'#2d3748', 'primaryTextColor':'#ffffff', 'primaryBorderColor':'#4a5568', 'lineColor':'#718096', 'sectionBkgColor':'#1a202c', 'altSectionBkgColor':'#2d3748', 'gridColor':'#4a5568', 'secondaryColor':'#2b6cb0', 'tertiaryColor':'#319795'}}}%%
graph TB
    subgraph AI_ENV ["AI Environment"]
        AI["AI Assistant<br/>Claude Code/Desktop"]
        MCP["MCP Server<br/>Node.js + TypeScript"]
    end
    
    subgraph COMM_LAYER ["Communication Layer"]
        HTTP["HTTP Bridge<br/>localhost:3002"]
        QUEUE["Request Queue<br/>UUID tracking"]
    end
    
    subgraph STUDIO_ENV ["Roblox Studio Environment"]
        PLUGIN["Studio Plugin<br/>Luau Script"]
        STUDIO["Roblox Studio<br/>APIs & Data"]
    end
    
    subgraph TOOLS ["18 AI Tools"]
        FILE["File System<br/>Trees, Search"]
        CONTEXT["Studio Context<br/>Services, Objects"]
        PROPS["Properties<br/>Get, Set, Mass Ops"]
        CREATE["Object Creation<br/>Single, Mass, Properties"]
        PROJECT["Project Analysis<br/>Smart Structure"]
    end
    
    AI -->|stdio| MCP
    MCP -->|HTTP POST| HTTP
    HTTP -->|Queue Request| QUEUE
    PLUGIN -->|Poll every 500ms| HTTP
    HTTP -->|Pending Work| PLUGIN
    PLUGIN -->|Execute APIs| STUDIO
    STUDIO -->|Return Data| PLUGIN
    PLUGIN -->|HTTP Response| HTTP
    HTTP -->|Resolve Promise| MCP
    MCP -->|Tool Result| AI
    
    MCP -.->|Exposes| FILE
    MCP -.->|Exposes| CONTEXT  
    MCP -.->|Exposes| PROPS
    MCP -.->|Exposes| CREATE
    MCP -.->|Exposes| PROJECT
    
    classDef aiStyle fill:#1e40af,stroke:#3b82f6,stroke-width:2px,color:#ffffff
    classDef mcpStyle fill:#7c3aed,stroke:#8b5cf6,stroke-width:2px,color:#ffffff
    classDef httpStyle fill:#ea580c,stroke:#f97316,stroke-width:2px,color:#ffffff
    classDef pluginStyle fill:#059669,stroke:#10b981,stroke-width:2px,color:#ffffff
    classDef studioStyle fill:#dc2626,stroke:#ef4444,stroke-width:2px,color:#ffffff
    classDef toolStyle fill:#0891b2,stroke:#06b6d4,stroke-width:2px,color:#ffffff
    
    class AI aiStyle
    class MCP mcpStyle
    class HTTP,QUEUE httpStyle
    class PLUGIN pluginStyle
    class STUDIO studioStyle
    class FILE,CONTEXT,PROPS,CREATE,PROJECT toolStyle
```

### Key Components:
- MCP Server (Node.js/TypeScript) - Exposes 18 tools via stdio
- HTTP Bridge - Request/response queue on localhost:3002
- Studio Plugin (Luau) - Polls server and executes API calls
- Smart Caching - Efficient data transfer

## 18 AI Tools

### File System Tools
- `get_file_tree` - Complete project hierarchy with scripts, models, folders
- `search_files` - Find files by name, type, or content patterns  

### Studio Context Tools  
- `get_place_info` - Place ID, name, game settings, workspace info
- `get_services` - All Roblox services and their child counts
- `search_objects` - Find instances by name, class, or properties

### Instance & Property Tools
- `get_instance_properties` - Complete property dump for any object
- `get_instance_children` - Child objects with metadata
- `search_by_property` - Find objects with specific property values
- `get_class_info` - Available properties/methods for Roblox classes

### Property Modification Tools 
- `set_property` - Set a property on any Roblox instance
- `mass_set_property` - Set the same property on multiple instances
- `mass_get_property` - Get the same property from multiple instances

### Object Creation Tools
- `create_object` - Create a new Roblox object instance
- `create_object_with_properties` - Create objects with initial properties
- `mass_create_objects` - Create multiple objects at once
- `mass_create_objects_with_properties` - Create multiple objects with properties
- `delete_object` - Delete a Roblox object instance

### Project Analysis Tools
- `get_project_structure` - Smart hierarchy with depth control (recommended: 5-10)

> Note: Previous tools removed: `get_file_content`, `get_file_properties`, `get_selection`, `get_dependencies`, `validate_references`. Use Rojo/Argon workflows instead.

## AI-Optimized Features

### Mass Operations (v1.3.0)
- Bulk property editing
- Mass object creation
- Batch property reading
- Atomic undo/redo operations

```typescript
// Example: Set multiple parts to red
mass_set_property(["game.Workspace.Part1", "game.Workspace.Part2"], "BrickColor", "Really red")
```

### Smart Project Structure
- Service overview with child counts
- Path-based exploration: `get_project_structure("game.ServerStorage", maxDepth=5)`
- Script-only filtering for code analysis
- Intelligent grouping for large folders
- Recommended maxDepth=5-10

### Rich Metadata
- Script status tracking
- GUI intelligence
- Performance optimized

## Development & Testing

### Commands
```bash
npm run dev         # Development server with hot reload  
npm run build       # Production build
npm start           # Run built server
npm run lint        # ESLint code quality
npm run typecheck   # TypeScript validation
```

### Plugin Development
- Live reload
- Robust error handling
- Debug logging
- Visual status indicators

## Communication Protocol

```mermaid
%%{init: {'theme':'dark', 'themeVariables': {'primaryColor':'#2d3748', 'primaryTextColor':'#ffffff', 'primaryBorderColor':'#4a5568', 'lineColor':'#10b981', 'sectionBkgColor':'#1a202c', 'altSectionBkgColor':'#2d3748', 'gridColor':'#4a5568', 'secondaryColor':'#3b82f6', 'tertiaryColor':'#8b5cf6', 'background':'#1a202c', 'mainBkg':'#2d3748', 'secondBkg':'#374151', 'tertiaryColor':'#6366f1'}}}%%
sequenceDiagram
    participant AI as AI Assistant
    participant MCP as MCP Server  
    participant HTTP as HTTP Bridge
    participant PLUGIN as Studio Plugin
    participant STUDIO as Roblox Studio
    
    Note over AI,STUDIO: Tool Request Flow
    
    AI->>+MCP: Call tool (e.g., get_file_tree)
    MCP->>+HTTP: Queue request with UUID
    HTTP->>HTTP: Store in pending requests map
    HTTP-->>-MCP: Request queued
    
    Note over PLUGIN: Polling every 500ms
    PLUGIN->>+HTTP: GET /poll
    HTTP->>-PLUGIN: Return pending request + UUID
    
    PLUGIN->>+STUDIO: Execute Studio APIs
    Note over STUDIO: game.ServerStorage<br/>Selection:Get()<br/>Instance properties
    STUDIO->>-PLUGIN: Return Studio data
    
    PLUGIN->>+HTTP: POST /response with UUID + data
    HTTP->>-MCP: Resolve promise with data
    MCP->>-AI: Return tool result
    
    Note over AI,STUDIO: Error Handling
    
    alt Request Timeout (30s)
        HTTP->>MCP: Reject promise with timeout
        MCP->>AI: Return error message
    end
    
    alt Plugin Disconnected
        PLUGIN->>HTTP: Connection lost
        HTTP->>HTTP: Exponential backoff retry
        Note over PLUGIN: Status: "Waiting for server..."
    end
```

**Features:**
- 30-second timeouts with exponential backoff
- Automatic retries
- Response limiting
- Request deduplication

## Example Usage

```javascript
// Get service overview
get_project_structure()

// Explore weapons folder
get_project_structure("game.ServerStorage.Weapons", maxDepth=2)

// Find all Sound objects  
search_by_property("ClassName", "Sound")

// Check script dependencies
get_dependencies("game.ServerScriptService.MainScript")

// Find broken references
validate_references()

// Get UI component details
get_instance_properties("game.StarterGui.MainMenu.SettingsFrame")
```

## Configuration

**Environment Variables:**
- `MCP_SERVER_PORT` - MCP server port (default: stdio)
- `HTTP_SERVER_PORT` - HTTP bridge port (default: 3002)
- `PLUGIN_POLL_INTERVAL` - Plugin poll frequency (default: 500ms)
- `REQUEST_TIMEOUT` - Request timeout (default: 30000ms)

**Studio Settings:**
- **Allow HTTP Requests** (Game Settings > Security)
- **HttpService.HttpEnabled = true**
- **Plugin activated** via toolbar button

## License

MIT License - Feel free to use in commercial and personal projects!
