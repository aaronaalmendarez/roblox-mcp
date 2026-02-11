#!/usr/bin/env node

import process from 'node:process';
import fetch from 'node-fetch';
import { getCurrentPlaceInfo, resolvePlaceContext } from './lib/place-context.mjs';

const MCP_BASE = (process.env.ROBLOX_MCP_URL || 'http://localhost:3002').replace(/\/$/, '');

function parseArgs(argv) {
  const out = {
    place: null,
    json: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--place' && argv[i + 1]) {
      out.place = argv[i + 1];
      i += 1;
    } else if (token === '--json') {
      out.json = true;
    }
  }

  return out;
}

async function check(url) {
  try {
    const res = await fetch(url);
    const text = await res.text();
    let body = text;
    try {
      body = JSON.parse(text);
    } catch {
      // keep raw text
    }
    return { ok: res.ok, status: res.status, body };
  } catch (error) {
    return { ok: false, status: 0, body: String(error) };
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`MCP base: ${MCP_BASE}`);
  const health = await check(`${MCP_BASE}/health`);
  const status = await check(`${MCP_BASE}/status`);
  let context = null;
  let contextError = null;
  let detected = null;

  try {
    context = await resolvePlaceContext({
      placeKey: args.place,
      autoDetect: true,
      useActive: true,
      allowLegacy: true,
    });
  } catch (error) {
    contextError = error instanceof Error ? error.message : String(error);
  }

  try {
    detected = await getCurrentPlaceInfo();
  } catch {
    detected = null;
  }

  if (args.json) {
    console.log(JSON.stringify({
      mcpBase: MCP_BASE,
      health,
      status,
      detectedPlace: detected,
      placeContext: context ? {
        mode: context.mode,
        place: context.place,
        paths: context.paths,
      } : null,
      placeContextError: contextError,
    }, null, 2));
    if (!health.ok || !status.ok || contextError) {
      process.exitCode = 1;
    }
    return;
  }

  console.log('\n/health');
  console.log(`- HTTP: ${health.ok ? 'OK' : 'FAIL'} (${health.status})`);
  console.log(`- Body: ${typeof health.body === 'string' ? health.body : JSON.stringify(health.body)}`);

  console.log('\n/status');
  console.log(`- HTTP: ${status.ok ? 'OK' : 'FAIL'} (${status.status})`);
  console.log(`- Body: ${typeof status.body === 'string' ? status.body : JSON.stringify(status.body)}`);

  console.log('\n/place-context');
  if (detected) {
    console.log(`- Detected Studio place: ${detected.placeName} (${detected.placeId})`);
  } else {
    console.log('- Detected Studio place: unavailable');
  }
  if (contextError) {
    console.log(`- Resolve: FAIL (${contextError})`);
  } else if (context) {
    if (context.mode === 'place') {
      console.log(`- Resolve: OK (place ${context.place.displayName} [${context.place.slug}])`);
    } else {
      console.log('- Resolve: OK (legacy blueprint-v1)');
    }
    console.log(`- Project: ${context.paths.project}`);
    console.log(`- Properties: ${context.paths.propertiesFile}`);
  }

  if (!health.ok || !status.ok || contextError) {
    console.log('\nAction: start Roblox Studio, enable plugin, and confirm HTTP requests are enabled.');
    if (contextError) {
      console.log('Action: register the current place with: node scripts/places.mjs detect --init-if-missing --set-active');
    }
    process.exitCode = 1;
    return;
  }

  console.log('\nDoctor checks passed.');
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
