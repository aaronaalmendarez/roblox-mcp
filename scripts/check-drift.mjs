#!/usr/bin/env node

import process from 'node:process';

const BASE = (process.env.ROBLOX_MCP_URL || 'http://localhost:3002').replace(/\/$/, '');

function parseArgs(argv) {
  const mappings = [];
  let normalizeLineEndings = true;
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === '--map' && argv[i + 1]) {
      const raw = argv[++i];
      const eq = raw.indexOf('=');
      if (eq <= 0 || eq >= raw.length - 1) {
        throw new Error(`Invalid --map "${raw}". Expected format: instancePath=localFile`);
      }
      mappings.push({
        instancePath: raw.slice(0, eq),
        localFile: raw.slice(eq + 1),
      });
    } else if (t === '--no-normalize-eol') {
      normalizeLineEndings = false;
    }
  }
  if (mappings.length === 0) {
    throw new Error('Usage: node scripts/check-drift.mjs --map game.ServerScriptService.Main=blueprint-v1/src/ServerScriptService/Main.server.luau [--map ...]');
  }
  return { mappings, normalizeLineEndings };
}

async function call(endpoint, payload) {
  const res = await fetch(`${BASE}/mcp/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  const data = JSON.parse(text);
  if (!res.ok) {
    throw new Error(`${endpoint} failed (${res.status}): ${JSON.stringify(data)}`);
  }
  if (Array.isArray(data.content) && data.content[0]?.text) {
    return JSON.parse(data.content[0].text);
  }
  return data;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await call('check_script_drift', args);
  console.log(JSON.stringify(result, null, 2));
  if ((result.summary?.drift || 0) > 0 || (result.summary?.failures || 0) > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
