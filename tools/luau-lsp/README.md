# luau-lsp

This folder contains the `luau-lsp` binary used by `npm run luau:lint`.

## Included

| File | Version | Platform |
|------|---------|----------|
| `luau-lsp-win64.zip` | v1.63.0 | Windows x64 |

## Setup

Extract `luau-lsp.exe` from the zip into `.tools/luau-lsp/`:

```powershell
Expand-Archive tools\luau-lsp\luau-lsp-win64.zip -DestinationPath .tools\luau-lsp -Force
```

Then generate the Rojo sourcemap:

```bash
rojo sourcemap blueprint-v1/places/<slug>/default.project.json --output sourcemap.json
```

Now `npm run luau:lint` will find the binary automatically.

## Alternative: Download Latest

The zip in this repo is pinned to v1.63.0. For the latest version:

👉 https://github.com/JohnnyMorganz/luau-lsp/releases/latest

Download `luau-lsp-win64.zip` (Windows), `luau-lsp-macos.zip` (macOS), or `luau-lsp-linux.zip` (Linux),
then extract `luau-lsp[.exe]` to `.tools/luau-lsp/`.
