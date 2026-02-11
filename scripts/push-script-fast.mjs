#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { gzipSync } from 'node:zlib';
import { normalizeLuaQuotedNewlines, stripUtf8Bom } from './lib/text-utils.mjs';

const BASE = (process.env.ROBLOX_MCP_URL || 'http://localhost:3002').replace(/\/$/, '');

function parseArgs(argv) {
  const args = {
    instancePath: '',
    file: '',
    endpoint: 'set_script_source_fast',
    verify: true,
    verbose: false,
    gzip: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === '--instance' && argv[i + 1]) {
      args.instancePath = argv[i + 1];
      i += 1;
    } else if (t === '--file' && argv[i + 1]) {
      args.file = argv[i + 1];
      i += 1;
    } else if (t === '--endpoint' && argv[i + 1]) {
      args.endpoint = argv[i + 1];
      i += 1;
    } else if (t === '--no-verify') {
      args.verify = false;
    } else if (t === '--verbose') {
      args.verbose = true;
    } else if (t === '--gzip') {
      args.gzip = true;
    }
  }

  if (!args.instancePath || !args.file) {
    throw new Error('Usage: node scripts/push-script-fast.mjs --instance <game.path.Script> --file <path>');
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const abs = path.resolve(process.cwd(), args.file);
  const sourceRaw = await fs.readFile(abs, 'utf8');
  const source = normalizeLuaQuotedNewlines(stripUtf8Bom(sourceRaw));

  const started = Date.now();
  const payload = args.gzip
    ? {
        instancePath: args.instancePath,
        sourceGzipBase64: gzipSync(Buffer.from(source, 'utf8')).toString('base64'),
        verify: args.verify,
      }
    : {
        instancePath: args.instancePath,
        source,
        verify: args.verify,
      };
  const endpoint = args.gzip ? 'set_script_source_fast_gzip' : args.endpoint;
  const result = await callMcp(endpoint, payload);
  const elapsed = Date.now() - started;

  const summary = {
    endpoint,
    instancePath: args.instancePath,
    chars: source.length,
    elapsedMs: elapsed,
    success: result?.success === true,
    method: result?.method ?? null,
    fallback: result?.fallback === true,
    payloadBytes: result?.payloadBytes ?? null,
  };

  if (args.verbose) {
    console.log(JSON.stringify({ ...summary, result }, null, 2));
    return;
  }

  console.log(JSON.stringify(summary));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
