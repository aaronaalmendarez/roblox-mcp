#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolvePlaceContext } from './lib/place-context.mjs';

const DEFAULT_DEBOUNCE_MS = 350;

function parseArgs(argv) {
  const args = {
    file: null,
    place: null,
    dryRun: false,
    debounceMs: DEFAULT_DEBOUNCE_MS,
    noInitial: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--file' && argv[i + 1]) {
      args.file = argv[i + 1];
      i += 1;
    } else if (token === '--place' && argv[i + 1]) {
      args.place = argv[i + 1];
      i += 1;
    } else if (token === '--dry-run') {
      args.dryRun = true;
    } else if (token === '--debounce-ms' && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error('Invalid --debounce-ms value');
      }
      args.debounceMs = Math.floor(parsed);
      i += 1;
    } else if (token === '--no-initial') {
      args.noInitial = true;
    }
  }

  return args;
}

function now() {
  return new Date().toLocaleTimeString();
}

async function fileExists(filePath) {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function runSync(syncScriptPath, targetFile, dryRun) {
  const args = [syncScriptPath, '--file', targetFile];
  if (dryRun) {
    args.push('--dry-run');
  }

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }
      reject(new Error(`sync exited with code ${String(code)}`));
    });
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  let resolvedFile = opts.file;
  let contextLabel = null;
  if (!resolvedFile) {
    const context = await resolvePlaceContext({
      placeKey: opts.place,
      autoDetect: true,
      useActive: true,
      allowLegacy: true,
    });
    resolvedFile = context.paths.propertiesFile;
    contextLabel = context.mode === 'place'
      ? `${context.place.displayName} (${context.place.placeId}) [${context.place.slug}]`
      : 'legacy blueprint-v1';
  }

  const targetFile = path.resolve(process.cwd(), resolvedFile);
  const targetDir = path.dirname(targetFile);
  const targetBase = path.basename(targetFile);

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const syncScriptPath = path.join(scriptDir, 'sync-roblox-properties.mjs');

  const hasTarget = await fileExists(targetFile);
  if (!hasTarget) {
    throw new Error(`Manifest file not found: ${targetFile}`);
  }

  let running = false;
  let pending = false;
  let timer = null;

  const triggerSync = async (reason) => {
    if (running) {
      pending = true;
      return;
    }

    running = true;
    console.log(`[${now()}] Sync start (${reason})`);
    try {
      await runSync(syncScriptPath, targetFile, opts.dryRun);
      console.log(`[${now()}] Sync done`);
    } catch (error) {
      console.error(`[${now()}] Sync failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      running = false;
      if (pending) {
        pending = false;
        await triggerSync('queued-change');
      }
    }
  };

  const schedule = (reason) => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      void triggerSync(reason);
    }, opts.debounceMs);
  };

  console.log('Blueprint property watcher active');
  if (contextLabel) {
    console.log(`- Context: ${contextLabel}`);
  }
  console.log(`- File: ${targetFile}`);
  console.log(`- Debounce: ${opts.debounceMs}ms`);
  console.log(`- Mode: ${opts.dryRun ? 'dry-run' : 'apply'}`);

  if (!opts.noInitial) {
    await triggerSync('initial');
  }

  const watcher = fs.watch(targetDir, { persistent: true }, (_eventType, filename) => {
    if (!filename) {
      return;
    }

    const changed = path.basename(String(filename));
    if (changed !== targetBase) {
      return;
    }

    schedule('file-change');
  });

  watcher.on('error', (error) => {
    console.error(`[${now()}] Watcher error: ${error instanceof Error ? error.message : String(error)}`);
  });

  const shutdown = () => {
    console.log(`\n[${now()}] Stopping watcher`);
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    watcher.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
