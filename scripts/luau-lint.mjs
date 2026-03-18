#!/usr/bin/env node
/**
 * luau-lint.mjs — wraps luau-lsp analyze with full Roblox type definitions.
 *
 * Uses luau-lsp (https://github.com/JohnnyMorganz/luau-lsp) which ships
 * bundled Roblox globalTypes so Player, BasePart, Vector3, etc. all resolve
 * correctly — no stubs needed, no `any` hacks required.
 *
 * Binary search order:
 *   1. LUAU_LSP_PATH env var
 *   2. .tools/luau-lsp/luau-lsp.exe  (Windows)
 *   3. .tools/luau-lsp/luau-lsp      (Linux/macOS)
 *   4. luau-lsp on PATH
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { resolvePlaceContext } from './lib/place-context.mjs';

// ── Binary detection ───────────────────────────────────────────────────────

function detectBinary() {
  if (process.env.LUAU_LSP_PATH && fs.existsSync(process.env.LUAU_LSP_PATH)) {
    return process.env.LUAU_LSP_PATH;
  }
  const binName = process.platform === 'win32' ? 'luau-lsp.exe' : 'luau-lsp';
  const local = path.resolve(process.cwd(), '.tools', 'luau-lsp', binName);
  if (fs.existsSync(local)) {
    return local;
  }
  return 'luau-lsp'; // fallback: hope it's on PATH
}

// ── Args ──────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    place: null,
    root: null,
    sourcemap: null,
    failOnFindings: false,
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--place' && argv[i + 1]) { args.place = argv[++i]; }
    else if (t === '--root' && argv[i + 1]) { args.root = argv[++i]; }
    else if (t === '--sourcemap' && argv[i + 1]) { args.sourcemap = argv[++i]; }
    else if (t === '--fail-on-findings') { args.failOnFindings = true; }
    else if (t === '--json') { args.json = true; }
  }
  return args;
}

// ── File walker ──────────────────────────────────────────────────────────

function collectLuauFiles(root) {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(lua|luau)$/.test(entry.name)) {
        files.push(full);
      }
    }
  }
  walk(root);
  return files.sort((a, b) => a.localeCompare(b));
}

// ── Runner ───────────────────────────────────────────────────────────────

function runAnalyze(bin, rootAbs, sourcemapPath, files) {
  return new Promise((resolve, reject) => {
    const args = [
      'analyze',
      '--no-flags-enabled',
      '--platform=roblox',   // enables bundled Roblox globalTypes
    ];

    if (sourcemapPath && fs.existsSync(sourcemapPath)) {
      args.push(`--sourcemap=${sourcemapPath}`);
    }

    // Pass each file explicitly
    args.push(...files);

    const child = spawn(bin, args, {
      cwd: process.cwd(),
      shell: false,
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', (c) => { stderr += c; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

// ── Diagnostic parsing ───────────────────────────────────────────────────

function parseDiagnostics(raw) {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0 && /:\d+/.test(l));
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Resolve src root via Blueprint V1 place context
  let root = args.root;
  let contextLabel = null;

  if (!root) {
    const ctx = await resolvePlaceContext({
      placeKey: args.place,
      autoDetect: true,
      useActive: true,
      allowLegacy: true,
    });
    root = ctx.paths.src;
    contextLabel = ctx.mode === 'place'
      ? `${ctx.place.displayName} (${ctx.place.placeId}) [${ctx.place.slug}]`
      : 'legacy blueprint-v1';
  }

  const rootAbs = path.resolve(process.cwd(), root);
  if (!fs.existsSync(rootAbs)) {
    throw new Error(`Source root not found: ${rootAbs}`);
  }

  // Sourcemap: explicit arg → project-root sourcemap.json → none
  const sourcemapPath = args.sourcemap
    ? path.resolve(process.cwd(), args.sourcemap)
    : path.resolve(process.cwd(), 'sourcemap.json');

  const bin = detectBinary();
  const files = collectLuauFiles(rootAbs);

  if (files.length === 0) {
    console.log('[luau-lint] No .lua/.luau files found.');
    return;
  }

  if (contextLabel) console.log(`[context] ${contextLabel}`);
  console.log(`[luau-lint] files=${files.length} analyzer=${bin}`);
  if (fs.existsSync(sourcemapPath)) {
    console.log(`[luau-lint] sourcemap=${path.relative(process.cwd(), sourcemapPath)}`);
  }

  const { code, stdout, stderr } = await runAnalyze(bin, rootAbs, sourcemapPath, files);

  const raw = stdout + stderr;
  const diagnostics = parseDiagnostics(raw);
  const findingsCount = diagnostics.length;

  if (diagnostics.length > 0) {
    console.log(diagnostics.join('\n'));
  }
  console.log(`[luau-lint] findings=${findingsCount}`);

  if (!fs.existsSync(path.resolve(process.cwd(), '.tools', 'luau-lsp',
    process.platform === 'win32' ? 'luau-lsp.exe' : 'luau-lsp')) && code !== 0 && !stdout && !stderr) {
    console.error('[luau-lint] luau-lsp not found. Place binary at .tools/luau-lsp/luau-lsp.exe');
    process.exit(1);
  }

  if (args.failOnFindings && findingsCount > 0) {
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
