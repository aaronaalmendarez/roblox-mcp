#!/usr/bin/env node

import process from 'node:process';

const BASE = (process.env.ROBLOX_MCP_URL || 'http://localhost:3002').replace(/\/$/, '');

async function call(endpoint, payload = {}) {
  const res = await fetch(`${BASE}/mcp/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${endpoint} failed (${res.status}): ${text}`);
  }
  return JSON.parse(text);
}

async function main() {
  const health = await fetch(`${BASE}/health`).then((r) => r.json());
  if (!health.pluginConnected) {
    throw new Error('Plugin is not connected. Open Studio and enable plugin.');
  }

  await call('get_place_info', {});
  await call('get_runtime_state', {});

  const probePath = 'game.ServerStorage.LiveSmokeProbe';
  try { await call('delete_object', { instancePath: probePath }); } catch {}
  await call('create_object', { className: 'Script', parent: 'game.ServerStorage', name: 'LiveSmokeProbe' });
  await call('set_script_source_fast', { instancePath: probePath, source: "print('live smoke')", verify: true });
  const src = await call('get_script_source', { instancePath: probePath });
  await call('delete_object', { instancePath: probePath });

  const body = src?.content?.[0]?.text ? JSON.parse(src.content[0].text) : src;
  if (!String(body.source || '').includes("live smoke")) {
    throw new Error('Live smoke source verification failed');
  }

  console.log('live-smoke: ok');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
