# Blueprint V1 — IDE + Studio Sync

Blueprint V1 is the file-system layer that keeps your local Luau source in sync with Roblox Studio. It's built on [Rojo](https://rojo.space/) and supports **multi-place projects** with automatic context selection.

---

## How It Works

```
Local files (blueprint-v1/)  ◄──── Rojo ────►  Roblox Studio
         │                                           │
    property manifests                        live instance tree
         │                                           │
         └──── sync scripts (npm run ...) ───────────┘
```

- **Rojo** handles script syncing (`.luau` files ↔ Studio scripts)
- **Sync scripts** handle non-script properties (Position, Size, Color, etc.)
- **Reverse sync** pulls Studio-side changes back to local files with conflict detection

---

## Directory Layout

### Multi-Place (Preferred)

```
blueprint-v1/
├── places/
│   ├── registry.json              # Place ID → slug mapping
│   ├── .active-place.json         # Currently active place context
│   └── <slug>/
│       ├── default.project.json   # Rojo project file for this place
│       ├── src/                   # Luau source tree
│       │   ├── ServerScriptService/
│       │   ├── ReplicatedStorage/
│       │   └── StarterPlayer/
│       └── properties/
│           ├── instances.json     # Non-script property manifest
│           └── schema.json        # Property schema definitions
```

### Legacy Single-Place (Still Supported)

```
blueprint-v1/
├── default.project.json
├── src/
└── properties/
    └── instances.json
```

> Scripts auto-detect which layout is active. Multi-place takes priority when `registry.json` exists.

---

## Place Management

| Command                                                   | What It Does                                              |
| --------------------------------------------------------- | --------------------------------------------------------- |
| `npm run place:detect`                                    | Auto-detect current Studio place ID and register it       |
| `npm run place:list`                                      | List all registered places and their slugs                |
| `npm run place:status`                                    | Show resolved project path, src path, and properties path |
| `node scripts/places.mjs use <id-or-slug>`                | Switch active place manually                              |
| `node scripts/places.mjs tag add <id-or-slug> tycoon,sim` | Tag a place for organization                              |

---

## Sync Commands

### Property Sync (Non-Script Data)

```bash
npm run blueprint:sync        # One-shot: apply instances.json → Studio
npm run blueprint:watch       # Continuous: watch for changes and sync
```

### Reverse Sync (Studio → Local Files)

```bash
npm run blueprint:reverse-sync    # Continuous guarded pull
node scripts/reverse-sync-rojo.mjs --once   # Single cycle
```

### Connectivity Check

```bash
npm run blueprint:doctor      # Verify server + plugin + Rojo connectivity
```

### Custom Overrides

All scripts accept explicit paths if you need to bypass auto-detection:

```bash
node scripts/sync-roblox-properties.mjs --file ./path/to/instances.json
node scripts/watch-roblox-properties.mjs --file ./path/to/instances.json --debounce-ms 500
node scripts/reverse-sync-rojo.mjs --project ./my.project.json --state-file ./state.json --conflict-dir ./conflicts
```

---

## Recommended Live Loop

A typical development session:

1. **Open Studio** → enable plugin → enable HTTP requests
2. **Register place:** `npm run place:detect`
3. **Start Rojo** against the place project (path from `npm run place:status`)
4. **Edit scripts** in the resolved `src/` directory
5. **Property sync:** `npm run blueprint:watch` for non-script properties
6. **Reverse sync:** `npm run blueprint:reverse-sync` when you've made Studio-side edits

---

## Reverse Sync Safeguards

The reverse sync system prevents accidental data loss:

| Safeguard          | How It Works                                                              |
| ------------------ | ------------------------------------------------------------------------- |
| **Hash baselines** | Each tracked script has a stored hash — only true changes trigger pulls   |
| **One-way guard**  | Only pulls when Studio changed and local did **not**                      |
| **Conflict files** | When both sides changed, writes a `.conflict` file instead of overwriting |
| **State tracking** | Persists sync state between runs                                          |

### State File Locations

| Mode            | State File                                            | Conflict Directory                                    |
| --------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| **Multi-place** | `blueprint-v1/places/<slug>/.reverse-sync-state.json` | `blueprint-v1/places/<slug>/.reverse-sync-conflicts/` |
| **Legacy**      | `blueprint-v1/.reverse-sync-state.json`               | `blueprint-v1/.reverse-sync-conflicts/`               |
