#!/usr/bin/env node

import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { resolvePlaceContext } from './lib/place-context.mjs';

const DEFAULT_BATCH_SIZE = 120;

function parseArgs(argv) {
  const args = {
    root: null,
    place: null,
    strict: false,
    formatter: 'plain',
    batchSize: DEFAULT_BATCH_SIZE,
    json: false,
    includeRobloxGlobals: false,
    failOnFindings: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--root' && argv[i + 1]) {
      args.root = argv[i + 1];
      i += 1;
    } else if (token === '--place' && argv[i + 1]) {
      args.place = argv[i + 1];
      i += 1;
    } else if (token === '--strict') {
      args.strict = true;
    } else if (token === '--formatter' && argv[i + 1]) {
      args.formatter = argv[i + 1];
      i += 1;
    } else if (token === '--batch-size' && argv[i + 1]) {
      const n = Number(argv[i + 1]);
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error(`Invalid --batch-size: ${argv[i + 1]}`);
      }
      args.batchSize = Math.floor(n);
      i += 1;
    } else if (token === '--json') {
      args.json = true;
    } else if (token === '--include-roblox-globals') {
      args.includeRobloxGlobals = true;
    } else if (token === '--fail-on-findings') {
      args.failOnFindings = true;
    }
  }

  if (args.formatter !== 'plain' && args.formatter !== 'gnu') {
    throw new Error(`Unsupported formatter: ${args.formatter}`);
  }

  return args;
}

const ROBLOX_GLOBAL_ALLOWLIST = new Set([
  'game',
  'workspace',
  'script',
  'task',
  'Instance',
  'Enum',
  'Vector2',
  'Vector3',
  'CFrame',
  'UDim',
  'UDim2',
  'Color3',
  'ColorSequence',
  'ColorSequenceKeypoint',
  'NumberSequence',
  'NumberSequenceKeypoint',
  'TweenInfo',
  'warn',
  'print',
]);

function parseDiagnostics(rawOutput) {
  const lines = rawOutput
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  return lines.filter((line) => /:\d+/.test(line));
}

function isRobloxUnknownGlobalDiagnostic(line) {
  const match = line.match(/Unknown global '([^']+)'/);
  if (!match) {
    return false;
  }
  return ROBLOX_GLOBAL_ALLOWLIST.has(match[1]);
}

function detectAnalyzerPath() {
  if (process.env.LUAU_ANALYZE_PATH && fssync.existsSync(process.env.LUAU_ANALYZE_PATH)) {
    return process.env.LUAU_ANALYZE_PATH;
  }

  const binName = process.platform === 'win32' ? 'luau-analyze.exe' : 'luau-analyze';
  const local = path.resolve(process.cwd(), '.tools', 'luau', 'current', process.platform, binName);
  if (fssync.existsSync(local)) {
    return local;
  }

  return 'luau-analyze';
}

async function collectLuauFiles(root) {
  const files = [];

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules') {
        continue;
      }
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext === '.lua' || ext === '.luau') {
          files.push(full);
        }
      }
    }
  }

  await walk(root);
  files.sort((a, b) => a.localeCompare(b));
  return files;
}

async function runAnalyze(analyzerPath, files, opts) {
  const args = [];
  args.push(`--formatter=${opts.formatter}`);
  if (opts.strict) {
    args.push('--mode=strict');
  }
  args.push(...files);

  return await new Promise((resolve, reject) => {
    const child = spawn(analyzerPath, args, {
      cwd: process.cwd(),
      shell: false,
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) {
    out.push(array.slice(i, i + size));
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let root = args.root;
  let contextLabel = null;

  if (!root) {
    const context = await resolvePlaceContext({
      placeKey: args.place,
      autoDetect: true,
      useActive: true,
      allowLegacy: true,
    });
    root = context.paths.src;
    contextLabel = context.mode === 'place'
      ? `${context.place.displayName} (${context.place.placeId}) [${context.place.slug}]`
      : 'legacy blueprint-v1';
  }

  const rootAbs = path.resolve(process.cwd(), root);
  if (!fssync.existsSync(rootAbs)) {
    throw new Error(`Source root not found: ${rootAbs}`);
  }

  const analyzerPath = detectAnalyzerPath();
  const files = await collectLuauFiles(rootAbs);
  if (files.length === 0) {
    const empty = {
      success: true,
      root: rootAbs,
      files: 0,
      message: 'No .lua/.luau files found.',
    };
    if (args.json) {
      console.log(JSON.stringify(empty, null, 2));
    } else {
      console.log('No .lua/.luau files found.');
    }
    return;
  }

  const batches = chunk(files, args.batchSize);
  let hadFindings = false;
  let failedToRun = false;
  let rawOutput = '';

  for (const group of batches) {
    const result = await runAnalyze(analyzerPath, group, args);
    rawOutput += result.stdout;
    rawOutput += result.stderr;

    if (result.code !== 0) {
      hadFindings = true;
    }
    if (result.code !== 0 && !result.stdout && result.stderr.includes('not recognized')) {
      failedToRun = true;
    }
  }

  const allDiagnostics = parseDiagnostics(rawOutput);
  const actionableDiagnostics = args.includeRobloxGlobals
    ? allDiagnostics
    : allDiagnostics.filter((line) => !isRobloxUnknownGlobalDiagnostic(line));
  const suppressedCount = allDiagnostics.length - actionableDiagnostics.length;
  const findingsCount = actionableDiagnostics.length;

  const summary = {
    success: !failedToRun && findingsCount === 0,
    context: contextLabel,
    root: rootAbs,
    analyzerPath,
    files: files.length,
    batches: batches.length,
    strict: args.strict,
    formatter: args.formatter,
    findings: findingsCount,
    diagnosticsTotal: allDiagnostics.length,
    diagnosticsSuppressed: suppressedCount,
    failOnFindings: args.failOnFindings,
  };

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
    if (actionableDiagnostics.length > 0) {
      console.log('\n# Analyzer Output');
      console.log(actionableDiagnostics.join('\n'));
    }
  } else {
    if (contextLabel) {
      console.log(`[context] ${contextLabel}`);
    }
    console.log(`[luau-lint] files=${files.length} batches=${batches.length} analyzer=${analyzerPath}`);
    if (actionableDiagnostics.length > 0) {
      console.log(actionableDiagnostics.join('\n'));
    }
    console.log(`[luau-lint] findings=${findingsCount} suppressed=${suppressedCount}`);
  }

  if (failedToRun) {
    console.error('luau-analyze not available. Run: npm run luau:install');
    process.exit(1);
  }
  if (args.failOnFindings && findingsCount > 0) {
    process.exit(2);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
