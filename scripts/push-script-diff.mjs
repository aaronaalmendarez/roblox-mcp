#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { normalizeLuaQuotedNewlines, stripUtf8Bom } from './lib/text-utils.mjs';

const BASE = (process.env.ROBLOX_MCP_URL || 'http://localhost:58741').replace(/\/$/, '');

function parseArgs(argv) {
  const args = {
    instancePath: '',
    file: '',
    verbose: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === '--instance' && argv[i + 1]) {
      args.instancePath = argv[i + 1];
      i += 1;
    } else if (t === '--file' && argv[i + 1]) {
      args.file = argv[i + 1];
      i += 1;
    } else if (t === '--verbose') {
      args.verbose = true;
    }
  }

  if (!args.instancePath || !args.file) {
    throw new Error('Usage: node scripts/push-script-diff.mjs --instance <game.path.Script> --file <path>');
  }

  return args;
}

async function callMcp(endpoint, payload) {
  const res = await fetch(`${BASE}/mcp/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`${endpoint} failed (${res.status}): ${JSON.stringify(data)}`);
  }

  if (data && Array.isArray(data.content) && data.content[0]?.text) {
    try {
      return JSON.parse(data.content[0].text);
    } catch {
      return data;
    }
  }
  return data;
}

function splitLines(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

function buildMinimalOp(remoteSource, localSource) {
  const a = splitLines(remoteSource);
  const b = splitLines(localSource);

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) {
    start += 1;
  }

  let endA = a.length - 1;
  let endB = b.length - 1;
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    endA -= 1;
    endB -= 1;
  }

  const changedLines = b.slice(start, endB + 1);
  const newContent = changedLines.join('\n');

  if (start >= a.length && start >= b.length) {
    return null;
  }

  // replace range if remote has changed region, else insert at end
  if (endA >= start) {
    return {
      op: 'replace',
      startLine: start + 1,
      endLine: endA + 1,
      newContent,
    };
  }

  return {
    op: 'insert',
    afterLine: start,
    newContent,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const abs = path.resolve(process.cwd(), args.file);
  const localSourceRaw = await fs.readFile(abs, 'utf8');
  const localSource = normalizeLuaQuotedNewlines(stripUtf8Bom(localSourceRaw));

  const snapshot = await callMcp('get_script_snapshot', { instancePath: args.instancePath });
  const remoteSource = typeof snapshot.source === 'string' ? snapshot.source : '';

  if (remoteSource === localSource) {
    console.log(JSON.stringify({ endpoint: 'push_script_diff', changed: false, reason: 'already-synced' }));
    return;
  }

  const op = buildMinimalOp(remoteSource, localSource);
  if (!op) {
    console.log(JSON.stringify({ endpoint: 'push_script_diff', changed: false, reason: 'no-op' }));
    return;
  }

  const started = Date.now();
  const result = await callMcp('batch_script_edits', {
    instancePath: args.instancePath,
    expectedHash: snapshot.sourceHash,
    rollbackOnFailure: true,
    fastMode: true,
    operations: [op],
  });
  const elapsedMs = Date.now() - started;

  const summary = {
    endpoint: 'push_script_diff',
    instancePath: args.instancePath,
    changed: true,
    operation: op.op,
    elapsedMs,
    success: result?.success === true,
    operationsApplied: result?.operationsApplied ?? null,
  };

  if (args.verbose) {
    console.log(JSON.stringify({ ...summary, op, result }, null, 2));
    return;
  }

  console.log(JSON.stringify(summary));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
