#!/usr/bin/env node

import process from 'node:process';

const BASE = (process.env.ROBLOX_MCP_URL || 'http://localhost:3002').replace(/\/$/, '');

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
  const rootPath = process.argv[2] || process.cwd();
  const result = await call('lint_deprecated_apis', { rootPath });
  console.log(JSON.stringify(result, null, 2));
  if ((result.totalFindings || 0) > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
