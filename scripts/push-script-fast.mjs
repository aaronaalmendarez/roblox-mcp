#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { gzipSync } from 'node:zlib';
import { stripUtf8Bom } from './lib/text-utils.mjs';

const BASE = (process.env.ROBLOX_MCP_URL || 'http://localhost:3002').replace(/\/$/, '');
const DEFAULT_CHUNK_SIZE = 8192;

function parseArgs(argv) {
  const args = {
    instancePath: '',
    file: '',
    endpoint: 'chunked_set_script_source',
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
  const source = stripUtf8Bom(sourceRaw);

  const started = Date.now();
  let endpoint = args.endpoint;
  let result;

  if (endpoint === 'chunked_set_script_source') {
    const begin = await callMcp('begin_script_source_upload', {
      instancePath: args.instancePath,
      mode: 'set',
    });
    const chunkSize = begin?.chunkSize ?? DEFAULT_CHUNK_SIZE;
    for (let offset = 0; offset < source.length; offset += chunkSize) {
      const chunk = source.slice(offset, offset + chunkSize);
      await callMcp('append_script_source_upload_chunk', {
        uploadId: begin.uploadId,
        chunk,
        chunkIndex: Math.floor(offset / chunkSize),
      });
    }
    endpoint = 'commit_script_source_upload';
    result = await callMcp(endpoint, {
      uploadId: begin.uploadId,
      rollbackOnFailure: true,
      preferFast: false,
    });
  } else {
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
    endpoint = args.gzip ? 'set_script_source_fast_gzip' : args.endpoint;
    result = await callMcp(endpoint, payload);
  }
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
