#!/usr/bin/env node

import { spawn } from 'node:child_process';
import process from 'node:process';
import { resolvePlaceContext } from './lib/place-context.mjs';

function parseArgs(argv) {
  const placeIndex = argv.indexOf('--place');
  const place = placeIndex >= 0 && argv[placeIndex + 1] ? argv[placeIndex + 1] : null;
  return {
    withRojo: argv.includes('--with-rojo'),
    withWatch: argv.includes('--with-watch'),
    withReverse: argv.includes('--with-reverse'),
    place,
  };
}

function run(name, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
    }
  });

  return child;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const children = [];
  const context = await resolvePlaceContext({
    placeKey: opts.place,
    autoDetect: true,
    useActive: true,
    allowLegacy: true,
  });
  const projectPath = context.paths.project;

  console.log('Starting studio dev orchestrator...');
  children.push(run('mcp-server', 'node', ['dist/index.js'], root));

  if (opts.withRojo) {
    children.push(run('rojo', 'rojo', ['serve', projectPath], root));
  }

  if (opts.withWatch) {
    const args = ['scripts/watch-roblox-properties.mjs'];
    if (opts.place) {
      args.push('--place', opts.place);
    }
    children.push(run('prop-watch', 'node', args, root));
  }

  if (opts.withReverse) {
    const args = ['scripts/reverse-sync-rojo.mjs'];
    if (opts.place) {
      args.push('--place', opts.place);
    }
    children.push(run('reverse-sync', 'node', args, root));
  }

  if (context.mode === 'place') {
    console.log(`Context: ${context.place.displayName} (${context.place.placeId}) [${context.place.slug}]`);
  } else {
    console.log('Context: legacy blueprint-v1');
  }
  console.log('Orchestrator active. Press Ctrl+C to stop all processes.');

  const shutdown = () => {
    console.log('\nStopping orchestrator...');
    for (const child of children) {
      try {
        child.kill();
      } catch {
        // ignore
      }
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
