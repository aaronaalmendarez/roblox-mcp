# Blueprint V1 (IDE + Studio Sync)

Blueprint v1 now supports multi-place projects with automatic context selection from live Studio place info.

## Layout

Preferred (multi-place):

- `blueprint-v1/places/registry.json`
- `blueprint-v1/places/.active-place.json`
- `blueprint-v1/places/<slug>/default.project.json`
- `blueprint-v1/places/<slug>/src/...`
- `blueprint-v1/places/<slug>/properties/instances.json`
- `blueprint-v1/places/<slug>/properties/schema.json`

Legacy fallback (still supported):

- `blueprint-v1/default.project.json`
- `blueprint-v1/src/...`
- `blueprint-v1/properties/instances.json`

## Place commands

Detect current Studio place and register if missing:

`npm run place:detect`

List places and active mapping:

`npm run place:list`

Show resolved context (project/src/properties) used by sync scripts:

`npm run place:status`

Switch active place manually:

`node scripts/places.mjs use <placeId-or-slug>`

Tag places:

`node scripts/places.mjs tag add <placeId-or-slug> tycoon,sim`

## Sync commands

Connectivity doctor:

`npm run blueprint:doctor`

Property apply (auto-resolves place):

`npm run blueprint:sync`

Property watch (auto-resolves place):

`npm run blueprint:watch`

Reverse sync Studio -> file (auto-resolves place):

`npm run blueprint:reverse-sync`

Custom overrides are still supported:

- `node scripts/sync-roblox-properties.mjs --file ./path/to/instances.json`
- `node scripts/watch-roblox-properties.mjs --file ./path/to/instances.json --debounce-ms 500`
- `node scripts/reverse-sync-rojo.mjs --project ./my.project.json --state-file ./state.json --conflict-dir ./conflicts`

## Recommended live loop

1. Start Studio, enable plugin, enable HTTP.
2. Register/select place:
`npm run place:detect`
3. Run Rojo against place project from `npm run place:status`.
4. Edit scripts in resolved `src/`.
5. Run `npm run blueprint:watch` for non-script properties.
6. Run `npm run blueprint:reverse-sync` when Studio-side edits need guarded pullback.

## Reverse-sync safeguards

- Uses hash baselines per tracked script.
- Pulls Studio -> file only when Studio changed and local did not.
- Writes conflicts when both sides changed.
- Place mode paths:
  - `blueprint-v1/places/<slug>/.reverse-sync-state.json`
  - `blueprint-v1/places/<slug>/.reverse-sync-conflicts/`
- Legacy mode paths:
  - `blueprint-v1/.reverse-sync-state.json`
  - `blueprint-v1/.reverse-sync-conflicts/`
