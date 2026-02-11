#!/usr/bin/env node

import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';
import fetch from 'node-fetch';
import { resolvePlaceContext } from './lib/place-context.mjs';

const DEFAULT_INTERVAL_MS = 2000;
const MCP_BASE = (process.env.ROBLOX_MCP_URL || 'http://localhost:3002').replace(/\/$/, '');

function parseArgs(argv) {
  const args = {
    project: null,
    intervalMs: DEFAULT_INTERVAL_MS,
    stateFile: null,
    conflictDir: null,
    place: null,
    noInitial: false,
    once: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--project' && argv[i + 1]) {
      args.project = argv[i + 1];
      i += 1;
    } else if (token === '--place' && argv[i + 1]) {
      args.place = argv[i + 1];
      i += 1;
    } else if (token === '--interval-ms' && argv[i + 1]) {
      const n = Number(argv[i + 1]);
      if (!Number.isFinite(n) || n < 250) {
        throw new Error('Invalid --interval-ms. Use a number >= 250');
      }
      args.intervalMs = Math.floor(n);
      i += 1;
    } else if (token === '--state-file' && argv[i + 1]) {
      args.stateFile = argv[i + 1];
      i += 1;
    } else if (token === '--conflict-dir' && argv[i + 1]) {
      args.conflictDir = argv[i + 1];
      i += 1;
    } else if (token === '--no-initial') {
      args.noInitial = true;
    } else if (token === '--once') {
      args.once = true;
    }
  }

  return args;
}

function now() {
  return new Date().toISOString();
}

function hashText(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function toPosixSegments(relativePath) {
  return relativePath.split(path.sep).filter(Boolean);
}

function scriptNameFromFile(filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  return base.replace(/\.(server|client)$/i, '');
}

async function isScriptFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.lua' || ext === '.luau';
}

async function walkFiles(rootDir) {
  const out = [];

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && await isScriptFile(full)) {
        out.push(full);
      }
    }
  }

  if (!fssync.existsSync(rootDir)) {
    return out;
  }

  await walk(rootDir);
  return out;
}

function collectPathMappings(tree, currentChain = [], out = []) {
  if (!tree || typeof tree !== 'object') {
    return out;
  }

  if (typeof tree.$path === 'string' && tree.$path.trim()) {
    out.push({ chain: currentChain.slice(), localPath: tree.$path.trim() });
  }

  for (const [key, value] of Object.entries(tree)) {
    if (key.startsWith('$')) {
      continue;
    }
    collectPathMappings(value, [...currentChain, key], out);
  }

  return out;
}

async function readJson(filePath) {
  const text = await fs.readFile(filePath, 'utf8');
  return JSON.parse(text);
}

async function loadState(filePath) {
  if (!fssync.existsSync(filePath)) {
    return { scripts: {} };
  }

  try {
    const state = await readJson(filePath);
    if (!state || typeof state !== 'object' || !state.scripts || typeof state.scripts !== 'object') {
      return { scripts: {} };
    }
    return state;
  } catch {
    return { scripts: {} };
  }
}

async function saveState(filePath, state) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

async function callMcp(tool, payload) {
  const response = await fetch(`${MCP_BASE}/mcp/${tool}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`MCP ${tool} failed (${response.status}): ${JSON.stringify(body)}`);
  }

  if (body && Array.isArray(body.content) && body.content[0] && typeof body.content[0].text === 'string') {
    try {
      return JSON.parse(body.content[0].text);
    } catch {
      return body;
    }
  }

  return body;
}

function instancePathForFile(serviceChain, mappingRoot, fullFilePath) {
  const rel = path.relative(mappingRoot, fullFilePath);
  const segments = toPosixSegments(rel);
  if (segments.length === 0) {
    return null;
  }

  const file = segments.pop();
  if (!file) {
    return null;
  }

  const scriptName = scriptNameFromFile(file);
  if (!scriptName) {
    return null;
  }

  const pathSegments = ['game', ...serviceChain, ...segments, scriptName];
  return pathSegments.join('.');
}

async function buildTrackedScripts(projectFile) {
  const projectDir = path.dirname(projectFile);
  const project = await readJson(projectFile);
  if (!project || typeof project !== 'object' || !project.tree) {
    throw new Error('Invalid Rojo project file: missing tree');
  }

  const mappings = collectPathMappings(project.tree, []);
  const tracked = [];

  for (const mapping of mappings) {
    const mappingRoot = path.resolve(projectDir, mapping.localPath);
    const files = await walkFiles(mappingRoot);
    for (const filePath of files) {
      const instancePath = instancePathForFile(mapping.chain, mappingRoot, filePath);
      if (!instancePath) {
        continue;
      }
      tracked.push({
        filePath,
        instancePath,
      });
    }
  }

  tracked.sort((a, b) => a.filePath.localeCompare(b.filePath));
  return tracked;
}

async function writeConflict(conflictDir, track, localSource, studioSource, reason) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeName = track.instancePath.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const baseDir = path.join(conflictDir, `${stamp}_${safeName}`);
  await fs.mkdir(baseDir, { recursive: true });

  const ext = path.extname(track.filePath) || '.luau';
  await fs.writeFile(path.join(baseDir, `local${ext}`), localSource, 'utf8');
  await fs.writeFile(path.join(baseDir, `studio${ext}`), studioSource, 'utf8');

  const meta = {
    timestamp: now(),
    instancePath: track.instancePath,
    filePath: track.filePath,
    reason,
    localHash: hashText(localSource),
    studioHash: hashText(studioSource),
  };
  await fs.writeFile(path.join(baseDir, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
  return baseDir;
}

async function processTrack(track, state, conflictDir) {
  const key = track.filePath;
  const previous = state.scripts[key] || null;

  const localSource = await fs.readFile(track.filePath, 'utf8');
  const localHash = hashText(localSource);

  let snapshot;
  try {
    snapshot = await callMcp('get_script_snapshot', { instancePath: track.instancePath });
  } catch (error) {
    console.log(`[skip] ${track.instancePath} :: snapshot unavailable (${error instanceof Error ? error.message : String(error)})`);
    return { updated: false, initialized: false, conflict: false };
  }

  const studioSource = typeof snapshot.source === 'string' ? snapshot.source : '';
  const studioHash = typeof snapshot.sourceHash === 'string' ? snapshot.sourceHash : hashText(studioSource);

  if (!previous) {
    state.scripts[key] = {
      instancePath: track.instancePath,
      lastLocalHash: localHash,
      lastStudioHash: studioHash,
      updatedAt: now(),
    };
    return { updated: false, initialized: true, conflict: false };
  }

  const studioChanged = studioHash !== previous.lastStudioHash;
  const localChanged = localHash !== previous.lastLocalHash;

  if (!studioChanged && !localChanged) {
    return { updated: false, initialized: false, conflict: false };
  }

  if (studioChanged && !localChanged) {
    await fs.writeFile(track.filePath, studioSource, 'utf8');
    const newLocalHash = hashText(studioSource);
    state.scripts[key] = {
      instancePath: track.instancePath,
      lastLocalHash: newLocalHash,
      lastStudioHash: studioHash,
      updatedAt: now(),
    };
    console.log(`[pull] ${track.instancePath} -> ${track.filePath}`);
    return { updated: true, initialized: false, conflict: false };
  }

  if (studioChanged && localChanged) {
    if (localHash === studioHash) {
      state.scripts[key] = {
        instancePath: track.instancePath,
        lastLocalHash: localHash,
        lastStudioHash: studioHash,
        updatedAt: now(),
      };
      return { updated: false, initialized: false, conflict: false };
    }

    const conflictPath = await writeConflict(
      conflictDir,
      track,
      localSource,
      studioSource,
      'Both local and Studio changed since last baseline'
    );

    state.scripts[key] = {
      instancePath: track.instancePath,
      lastLocalHash: localHash,
      lastStudioHash: studioHash,
      updatedAt: now(),
      lastConflictAt: now(),
      lastConflictPath: conflictPath,
    };

    console.log(`[conflict] ${track.instancePath} :: saved snapshots to ${conflictPath}`);
    return { updated: false, initialized: false, conflict: true };
  }

  if (!studioChanged && localChanged) {
    state.scripts[key] = {
      instancePath: track.instancePath,
      lastLocalHash: localHash,
      lastStudioHash: studioHash,
      updatedAt: now(),
    };
    return { updated: false, initialized: false, conflict: false };
  }

  return { updated: false, initialized: false, conflict: false };
}

async function runCycle(tracks, state, conflictDir) {
  let updated = 0;
  let conflicts = 0;
  let initialized = 0;

  for (const track of tracks) {
    try {
      const result = await processTrack(track, state, conflictDir);
      if (result.updated) {
        updated += 1;
      }
      if (result.conflict) {
        conflicts += 1;
      }
      if (result.initialized) {
        initialized += 1;
      }
    } catch (error) {
      console.log(`[error] ${track.instancePath} :: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { updated, conflicts, initialized };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const needsContext = Boolean(opts.place || !opts.project || !opts.stateFile || !opts.conflictDir);
  const context = needsContext
    ? await resolvePlaceContext({
      placeKey: opts.place,
      autoDetect: true,
      useActive: true,
      allowLegacy: true,
    })
    : null;
  const projectFile = path.resolve(process.cwd(), opts.project || context?.paths.project || '');
  const stateFile = path.resolve(process.cwd(), opts.stateFile || context?.paths.stateFile || '');
  const conflictDir = path.resolve(process.cwd(), opts.conflictDir || context?.paths.conflictDir || '');

  if (!fssync.existsSync(projectFile)) {
    throw new Error(`Project file not found: ${projectFile}`);
  }

  const tracks = await buildTrackedScripts(projectFile);
  if (tracks.length === 0) {
    throw new Error('No tracked script files found from project mapping.');
  }

  const state = await loadState(stateFile);

  console.log('Blueprint reverse-sync watcher active');
  if (context) {
    if (context.mode === 'place') {
      console.log(`- Context: ${context.place.displayName} (${context.place.placeId}) [${context.place.slug}]`);
    } else {
      console.log('- Context: legacy blueprint-v1');
    }
  } else {
    console.log('- Context: explicit custom paths');
  }
  console.log(`- Project: ${projectFile}`);
  console.log(`- Tracked scripts: ${tracks.length}`);
  console.log(`- Poll interval: ${opts.intervalMs}ms`);
  console.log(`- State file: ${stateFile}`);
  console.log(`- Conflict dir: ${conflictDir}`);

  let running = false;
  let queued = false;

  const cycle = async (reason) => {
    if (running) {
      queued = true;
      return;
    }

    running = true;
    const started = Date.now();
    try {
      const result = await runCycle(tracks, state, conflictDir);
      await saveState(stateFile, state);
      const elapsed = Date.now() - started;
      if (result.updated > 0 || result.conflicts > 0 || reason === 'initial') {
        console.log(`[cycle:${reason}] updated=${result.updated} conflicts=${result.conflicts} initialized=${result.initialized} elapsedMs=${elapsed}`);
      }
    } finally {
      running = false;
      if (queued) {
        queued = false;
        await cycle('queued');
      }
    }
  };

  if (!opts.noInitial) {
    await cycle('initial');
  }

  if (opts.once) {
    await saveState(stateFile, state);
    console.log(`[${now()}] Reverse-sync once run complete`);
    return;
  }

  const timer = setInterval(() => {
    void cycle('poll');
  }, opts.intervalMs);

  const shutdown = async () => {
    clearInterval(timer);
    await saveState(stateFile, state);
    console.log(`\n[${now()}] Reverse-sync watcher stopped`);
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
