#!/usr/bin/env node

import process from 'node:process';

const BASE = (process.env.ROBLOX_MCP_URL || 'http://localhost:3002').replace(/\/$/, '');

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${url} failed (${res.status})`);
  }
  return res.json();
}

async function main() {
  const once = process.argv.includes('--once');
  const intervalMs = 2000;

  const run = async () => {
    const m = await fetchJson(`${BASE}/metrics`);
    const b = m.bridge || {};
    const line = [
      new Date().toISOString(),
      `inFlight=${b.inFlightRequests ?? 0}`,
      `avg=${b.averageLatencyMs ?? 0}ms`,
      `p50=${b.p50LatencyMs ?? 0}ms`,
      `p90=${b.p90LatencyMs ?? 0}ms`,
      `p99=${b.p99LatencyMs ?? 0}ms`,
      `req=${b.totalRequests ?? 0}`,
      `ok=${b.totalResolved ?? 0}`,
      `rej=${b.totalRejected ?? 0}`,
    ].join(' | ');
    console.log(line);
  };

  if (once) {
    await run();
    return;
  }

  await run();
  setInterval(() => {
    run().catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
    });
  }, intervalMs);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
