#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { stripUtf8Bom } from './lib/text-utils.mjs';

const BASE = (process.env.ROBLOX_MCP_URL || 'http://localhost:3002').replace(/\/$/, '');
const DEFAULT_CHUNK_SIZE = 8192;

function parseArgs(argv) {
  const args = {
    instancePath: '',
    file: '',
    expectedHash: undefined,
    verifyNeedle: undefined,
    rollbackOnFailure: true,
    preferFast: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === '--instance' && argv[i + 1]) {
      args.instancePath = argv[++i];
    } else if (t === '--file' && argv[i + 1]) {
      args.file = argv[++i];
    } else if (t === '--expected-hash' && argv[i + 1]) {
      args.expectedHash = argv[++i];
    } else if (t === '--needle' && argv[i + 1]) {
      args.verifyNeedle = argv[++i];
    } else if (t === '--no-rollback') {
      args.rollbackOnFailure = false;
    } else if (t === '--prefer-fast') {
      args.preferFast = true;
    }
  }
  if (!args.instancePath || !args.file) {
    throw new Error('Usage: node scripts/apply-verify.mjs --instance <game.path.Script> --file <local file> [--needle text] [--expected-hash hash]');
  }
  return args;
}

async function call(endpoint, payload) {
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
  if (Array.isArray(data.content) && data.content[0]?.text) {
    try {
      return JSON.parse(data.content[0].text);
    } catch {
      return data;
    }
  }
  return data;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceRaw = await fs.readFile(path.resolve(process.cwd(), args.file), 'utf8');
  const source = stripUtf8Bom(sourceRaw);
  const started = Date.now();
  const begin = await call('begin_script_source_upload', {
    instancePath: args.instancePath,
    expectedHash: args.expectedHash,
    mode: 'apply_and_verify',
  });
  const chunkSize = begin?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  for (let offset = 0; offset < source.length; offset += chunkSize) {
    await call('append_script_source_upload_chunk', {
      uploadId: begin.uploadId,
      chunk: source.slice(offset, offset + chunkSize),
      chunkIndex: Math.floor(offset / chunkSize),
    });
  }
  const result = await call('commit_script_source_upload', {
    uploadId: begin.uploadId,
    verifyNeedle: args.verifyNeedle,
    rollbackOnFailure: args.rollbackOnFailure,
    preferFast: args.preferFast,
  });
  console.log(JSON.stringify({
    success: result?.success === true,
    instancePath: args.instancePath,
    elapsedMs: Date.now() - started,
    snapshotId: result?.snapshotId || null,
    targetHash: result?.targetHash || null,
    afterHash: result?.afterHash || null,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
