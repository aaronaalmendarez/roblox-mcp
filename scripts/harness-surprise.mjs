#!/usr/bin/env node

import process from 'node:process';

const BASE = (process.env.ROBLOX_MCP_URL || 'http://localhost:3002').replace(/\/$/, '');
const TARGET = 'game.ServerStorage.HarnessSurpriseDemo';

async function post(endpoint, payload = {}, headers = {}) {
  const res = await fetch(`${BASE}/mcp/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
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
  return data;
}

function toolPayload(response) {
  if (Array.isArray(response?.content) && response.content[0]?.text) {
    try {
      return JSON.parse(response.content[0].text);
    } catch {
      return response;
    }
  }
  return response;
}

async function main() {
  const health = await fetch(`${BASE}/health`).then((r) => r.json());
  if (!health.pluginConnected || !health.mcpServerActive) {
    throw new Error('Plugin/MCP not ready. Open Studio + enable plugin first.');
  }

  try {
    await post('delete_object', { instancePath: TARGET });
  } catch {}

  await post('create_object', {
    className: 'Script',
    parent: 'game.ServerStorage',
    name: 'HarnessSurpriseDemo',
  });

  const baseline = "local state = 'baseline'\nprint('harness baseline', state)";
  await post('set_script_source_fast', {
    instancePath: TARGET,
    source: baseline,
    verify: true,
  });

  const snap = toolPayload(await post('create_script_snapshot', {
    instancePath: TARGET,
    label: 'surprise-baseline',
  }));

  const advanced = "local state = 'advanced'\nprint('harness advanced', state)";
  const apply = toolPayload(await post('apply_and_verify_script_source', {
    instancePath: TARGET,
    source: advanced,
    verifyNeedle: 'harness advanced',
    rollbackOnFailure: true,
    preferFast: true,
  }));

  const idemKey = `surprise-${Date.now()}`;
  const first = await post('set_script_source_fast', {
    instancePath: TARGET,
    source: advanced,
    verify: true,
  }, { 'X-Idempotency-Key': idemKey });
  const second = await post('set_script_source_fast', {
    instancePath: TARGET,
    source: advanced,
    verify: true,
  }, { 'X-Idempotency-Key': idemKey });

  const firstParsed = toolPayload(first);
  const secondParsed = toolPayload(second);
  const replayed = second?.idempotency?.replayed === true;

  const rollback = toolPayload(await post('rollback_script_snapshot', {
    snapshotId: snap.snapshotId,
    verify: true,
  }));

  const diagnostics = await fetch(`${BASE}/diagnostics`).then((r) => r.json());
  const runtime = toolPayload(await post('get_runtime_state', {}));

  await post('delete_object', { instancePath: TARGET });

  const report = {
    wow: 'Harness Surprise Complete',
    checks: {
      healthReady: health.pluginConnected && health.mcpServerActive,
      snapshotCreated: Boolean(snap?.snapshotId),
      applyAndVerifySuccess: apply?.success === true,
      idempotencyReplayed: replayed,
      rollbackSuccess: rollback?.success === true,
      cleanupDeleted: true,
    },
    highlights: {
      pluginVersion: diagnostics?.plugin?.version ?? null,
      pluginInstanceId: diagnostics?.plugin?.instanceId ?? null,
      applySnapshotId: apply?.snapshotId ?? null,
      rollbackSnapshotId: rollback?.snapshotId ?? null,
      writeQueue: runtime?.writeQueue ?? null,
      idempotencyEntries: diagnostics?.idempotency?.entries ?? null,
      firstWriteMethod: firstParsed?.method ?? null,
      secondWriteMethod: secondParsed?.method ?? null,
    }
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
