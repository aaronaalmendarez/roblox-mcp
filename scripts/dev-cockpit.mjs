#!/usr/bin/env node

import process from 'node:process';

const BASE = (process.env.ROBLOX_MCP_URL || 'http://localhost:3002').replace(/\/$/, '');

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${path} failed (${res.status}): ${text}`);
  }
  return JSON.parse(text);
}

async function postJson(path, payload = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${path} failed (${res.status}): ${text}`);
  }
  return JSON.parse(text);
}

function extractToolPayload(toolResponse) {
  if (Array.isArray(toolResponse?.content) && toolResponse.content[0]?.text) {
    try {
      return JSON.parse(toolResponse.content[0].text);
    } catch {
      return toolResponse;
    }
  }
  return toolResponse;
}

async function main() {
  const health = await getJson('/health');
  const status = await getJson('/status');
  const diagnostics = await getJson('/diagnostics');
  const runtime = extractToolPayload(await postJson('/mcp/get_runtime_state', {}));

  const snapshot = {
    now: new Date().toISOString(),
    health: {
      pluginConnected: health.pluginConnected,
      mcpServerActive: health.mcpServerActive,
      pluginVersion: health.plugin?.version || null,
      pluginInstanceId: health.plugin?.instanceId || null,
      p90LatencyMs: health.bridge?.p90LatencyMs ?? null,
    },
    status: {
      uptimeMs: status.uptime,
      inFlightRequests: status.bridge?.inFlightRequests ?? null,
      totalRequests: status.bridge?.totalRequests ?? null,
    },
    diagnostics: {
      readiness: diagnostics.readiness,
      idempotencyEntries: diagnostics.idempotency?.entries ?? 0,
      recentErrors: (diagnostics.recentErrors || []).slice(-5),
    },
    runtime: {
      writeQueue: runtime.writeQueue || null,
      fastEndpointSupport: runtime.fastEndpointSupport || null,
      snapshots: runtime.snapshots || null,
    }
  };
  console.log(JSON.stringify(snapshot, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
