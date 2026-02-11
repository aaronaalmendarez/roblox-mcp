#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import fetch from 'node-fetch';
import { resolvePlaceContext } from './lib/place-context.mjs';

const MCP_BASE = (process.env.ROBLOX_MCP_URL || 'http://localhost:3002').replace(/\/$/, '');

function parseArgs(argv) {
  const args = {
    file: null,
    place: null,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--file' && argv[i + 1]) {
      args.file = argv[i + 1];
      i += 1;
    } else if (token === '--place' && argv[i + 1]) {
      args.place = argv[i + 1];
      i += 1;
    } else if (token === '--dry-run') {
      args.dryRun = true;
    }
  }
  return args;
}

function assertString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid ${label}`);
  }
}

async function postMcp(tool, payload) {
  const res = await fetch(`${MCP_BASE}/mcp/${tool}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = { raw: await res.text() };
  }

  if (!res.ok) {
    const detail = typeof data === 'object' ? JSON.stringify(data) : String(data);
    throw new Error(`${tool} failed (${res.status}): ${detail}`);
  }

  return data;
}

function opSummary(kind, instancePath, extra) {
  return `${kind} ${instancePath}${extra ? ` :: ${extra}` : ''}`;
}

async function run() {
  const { file, place, dryRun } = parseArgs(process.argv.slice(2));
  let absolute = null;

  if (file) {
    absolute = path.resolve(process.cwd(), file);
  } else {
    const context = await resolvePlaceContext({
      placeKey: place,
      autoDetect: true,
      useActive: true,
      allowLegacy: true,
    });
    absolute = path.resolve(process.cwd(), context.paths.propertiesFile);
    const contextLabel = context.mode === 'place'
      ? `${context.place.displayName} (${context.place.placeId}) [${context.place.slug}]`
      : 'legacy blueprint-v1';
    console.log(`[context] ${contextLabel}`);
  }

  const source = await fs.readFile(absolute, 'utf8');
  const manifest = JSON.parse(source);

  if (!manifest || !Array.isArray(manifest.instances)) {
    throw new Error('Manifest must contain an "instances" array.');
  }

  let totalOps = 0;
  let successOps = 0;
  const failures = [];

  for (const instance of manifest.instances) {
    assertString(instance.path, 'instance.path');
    const instancePath = instance.path;

    const properties = instance.properties || {};
    const attributes = instance.attributes || {};
    const tags = Array.isArray(instance.tags) ? instance.tags : [];

    for (const [propertyName, propertyValue] of Object.entries(properties)) {
      totalOps += 1;
      const line = opSummary('set_property', instancePath, propertyName);
      if (dryRun) {
        console.log(`[dry-run] ${line}`);
        successOps += 1;
        continue;
      }

      try {
        await postMcp('set_property', { instancePath, propertyName, propertyValue });
        console.log(`[ok] ${line}`);
        successOps += 1;
      } catch (error) {
        failures.push(`${line} -> ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    for (const [attributeName, attributeValue] of Object.entries(attributes)) {
      totalOps += 1;
      const line = opSummary('set_attribute', instancePath, attributeName);
      if (dryRun) {
        console.log(`[dry-run] ${line}`);
        successOps += 1;
        continue;
      }

      try {
        await postMcp('set_attribute', { instancePath, attributeName, attributeValue });
        console.log(`[ok] ${line}`);
        successOps += 1;
      } catch (error) {
        failures.push(`${line} -> ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    for (const tagName of tags) {
      assertString(tagName, 'tag');
      totalOps += 1;
      const line = opSummary('add_tag', instancePath, tagName);
      if (dryRun) {
        console.log(`[dry-run] ${line}`);
        successOps += 1;
        continue;
      }

      try {
        await postMcp('add_tag', { instancePath, tagName });
        console.log(`[ok] ${line}`);
        successOps += 1;
      } catch (error) {
        failures.push(`${line} -> ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  console.log(`\nDone: ${successOps}/${totalOps} operations succeeded.`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const entry of failures) {
      console.log(`- ${entry}`);
    }
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
