#!/usr/bin/env node
// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  studio-cli — The All-in-One Roblox Studio CLI                     ║
// ║  MCP · Rojo · Blueprint V1 · Process Orchestration · Lint · Sync    ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import fetch from 'node-fetch';

import {
  banner, bullet, c, drawBox, drawTable, err, header, info, logo, ok,
  progressBar, running, section, Spinner, stopped, style, truncate, warn,
} from './cli/ui.mjs';
import {
  getStatus, isAlive, listTracked, removePid, run, runDetached, stopAll, stopProcess,
} from './cli/proc.mjs';
import { resolvePlaceContext, loadActiveSelection, loadRegistry, listPlaces, findPlace, setActivePlaceByKey } from './lib/place-context.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PACKAGE_JSON = path.join(ROOT, 'package.json');

const MCP_BASE = (process.env.ROBLOX_MCP_URL || 'http://localhost:3002').replace(/\/$/, '');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Argument Parser
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function parseArgs(argv) {
  const args = {
    command: null,
    subcommand: null,
    positionals: [],
    flags: {},
    booleans: new Set(),
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      args.booleans.add('help');
      continue;
    }
    if (token === '--version' || token === '-v') {
      args.booleans.add('version');
      continue;
    }
    if (token === '--verbose') {
      args.booleans.add('verbose');
      continue;
    }
    if (token === '--json') {
      args.booleans.add('json');
      continue;
    }
    if (token === '--place' && argv[i + 1]) {
      args.flags.place = argv[i + 1];
      i++;
      continue;
    }
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) {
        args.flags[key] = next;
        i++;
      } else {
        args.booleans.add(key);
      }
      continue;
    }
    if (!args.command) {
      args.command = token;
    } else if (!args.subcommand) {
      args.subcommand = token;
    } else {
      args.positionals.push(token);
    }
  }
  return args;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function getVersion() {
  try {
    const raw = await fs.readFile(PACKAGE_JSON, 'utf8');
    const pkg = JSON.parse(raw);
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

async function resolveContext(args) {
  return resolvePlaceContext({
    placeKey: args.flags.place,
    autoDetect: true,
    useActive: true,
    allowLegacy: true,
  });
}

function hasCommand(cmd) {
  try {
    execSync(`where ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function execInherit(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit', shell: true });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}`));
    });
  });
}

function execCapture(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: true });
    let out = '';
    let errData = '';
    child.stdout?.on('data', (d) => { out += d; });
    child.stderr?.on('data', (d) => { errData += d; });
    child.on('exit', (code) => {
      resolve({ code, stdout: out, stderr: errData });
    });
  });
}

async function waitForMcp(timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${MCP_BASE}/health`, { signal: AbortSignal.timeout(500) });
      if (res.ok) return true;
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function waitForRojo(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch('http://127.0.0.1:34872/api/health', { signal: AbortSignal.timeout(500) });
      if (res.ok) return true;
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Commands
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function cmdDev(args) {
  console.log(logo());
  console.log();

  const withRojo = args.booleans.has('no-rojo') ? false : true;
  const withWatch = args.booleans.has('no-watch') ? false : true;
  const withReverse = args.booleans.has('no-reverse') ? false : true;
  const verbose = args.booleans.has('verbose');

  const spin = new Spinner('Resolving place context...').start();
  const context = await resolveContext(args);
  spin.succeed(`Resolved: ${context.place ? context.place.displayName : 'legacy blueprint-v1'} ${context.place ? `[${c.dim}${context.place.slug}${c.reset}]` : ''}`);

  const projectPath = context.paths.project;
  const children = [];

  // MCP Server
  const mcpStatus = await getStatus('mcp-server');
  if (!mcpStatus.running) {
    const s = new Spinner('Starting MCP server...').start();
    const child = run('mcp-server', 'node', ['dist/index.js'], ROOT, {
      stdio: verbose ? 'inherit' : 'ignore',
      onExit: (code) => {
        if (code && code !== 0) console.log(`\n${err('MCP server exited with code ' + code)}`);
      },
    });
    children.push(child);
    const up = await waitForMcp(10000);
    if (up) {
      s.succeed('MCP server listening on port 3002');
    } else {
      s.warn('MCP server started but health check timed out');
    }
  } else {
    console.log(`${running('MCP server')} already running (pid ${mcpStatus.pid})`);
  }

  // Rojo
  if (withRojo) {
    const rojoStatus = await getStatus('rojo');
    if (!rojoStatus.running) {
      if (!hasCommand('rojo')) {
        console.log(`${err('rojo not found')} Install with: cargo install rojo`);
      } else {
        const s = new Spinner('Starting Rojo server...').start();
        const child = run('rojo', 'rojo', ['serve', projectPath], ROOT, {
          stdio: verbose ? 'inherit' : 'ignore',
          onExit: (code) => {
            if (code && code !== 0) console.log(`\n${err('Rojo exited with code ' + code)}`);
          },
        });
        children.push(child);
        const up = await waitForRojo(15000);
        if (up) {
          s.succeed('Rojo server listening on port 34872');
        } else {
          s.warn('Rojo started but health check timed out');
        }
      }
    } else {
      console.log(`${running('Rojo server')} already running (pid ${rojoStatus.pid})`);
    }
  }

  // Property Watch
  if (withWatch) {
    const watchStatus = await getStatus('prop-watch');
    if (!watchStatus.running) {
      const s = new Spinner('Starting property watcher...').start();
      const scriptArgs = ['scripts/watch-roblox-properties.mjs'];
      if (args.flags.place) scriptArgs.push('--place', args.flags.place);
      const child = run('prop-watch', 'node', scriptArgs, ROOT, {
        stdio: verbose ? 'inherit' : 'ignore',
      });
      children.push(child);
      s.succeed('Property watcher active');
    } else {
      console.log(`${running('Property watcher')} already running (pid ${watchStatus.pid})`);
    }
  }

  // Reverse Sync
  if (withReverse) {
    const revStatus = await getStatus('reverse-sync');
    if (!revStatus.running) {
      const s = new Spinner('Starting reverse sync...').start();
      const scriptArgs = ['scripts/reverse-sync-rojo.mjs'];
      if (args.flags.place) scriptArgs.push('--place', args.flags.place);
      const child = run('reverse-sync', 'node', scriptArgs, ROOT, {
        stdio: verbose ? 'inherit' : 'ignore',
      });
      children.push(child);
      s.succeed('Reverse sync active');
    } else {
      console.log(`${running('Reverse sync')} already running (pid ${revStatus.pid})`);
    }
  }

  console.log();
  console.log(drawBox([
    `${c.bold}Project:${c.reset}  ${projectPath}`,
    `${c.bold}Mode:${c.reset}     ${context.mode}`,
    `${c.bold}Studio:${c.reset}   ${c.brightGreen}●${c.reset} Press Ctrl+C to stop all`,
  ], { title: 'Dev Environment', color: c.brightCyan }));

  const shutdown = () => {
    console.log(`\n${c.yellow}━━ Stopping dev environment...${c.reset}`);
    for (const child of children) {
      try { child.kill(); } catch { /* ignore */ }
    }
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

async function cmdServe(args) {
  const spin = new Spinner('Resolving place context...').start();
  const context = await resolveContext(args);
  spin.succeed(`Resolved: ${context.place ? context.place.displayName : 'legacy'}`);

  const rojoStatus = await getStatus('rojo');
  if (rojoStatus.running) {
    console.log(`${running('Rojo')} already running (pid ${rojoStatus.pid})`);
    return;
  }

  if (!hasCommand('rojo')) {
    console.log(`${err('rojo not found')} Install with: cargo install rojo`);
    process.exit(1);
  }

  const s = new Spinner('Starting Rojo server...').start();
  const child = run('rojo', 'rojo', ['serve', context.paths.project], ROOT, {
    stdio: 'inherit',
  });

  const up = await waitForRojo(15000);
  if (up) {
    s.succeed('Rojo server listening on port 34872');
  } else {
    s.warn('Rojo started but health check timed out');
  }

  console.log(`${c.dim}Press Ctrl+C to stop${c.reset}`);
}

async function cmdMcp(args) {
  const verbose = args.booleans.has('verbose');
  const status = await getStatus('mcp-server');
  if (status.running) {
    console.log(`${running('MCP server')} already running (pid ${status.pid})`);
    return;
  }

  const s = new Spinner('Starting MCP server...').start();
  const child = run('mcp-server', 'node', ['dist/index.js'], ROOT, {
    stdio: verbose ? 'inherit' : 'ignore',
    onExit: (code) => {
      if (code && code !== 0) console.log(`\n${err('MCP server exited with code ' + code)}`);
    },
  });

  const up = await waitForMcp(10000);
  if (up) {
    s.succeed('MCP server listening on port 3002');
  } else {
    s.warn('MCP server started but health check timed out');
  }

  if (!verbose) {
    console.log(`${c.dim}Press Ctrl+C to stop${c.reset}`);
    const shutdown = () => { try { child.kill(); } catch { /* ignore */ } process.exit(0); };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
}

async function cmdSync(args) {
  const spin = new Spinner('Resolving place context...').start();
  const context = await resolveContext(args);
  spin.succeed(`Resolved: ${context.place ? context.place.displayName : 'legacy'}`);

  const scriptArgs = ['scripts/sync-roblox-properties.mjs'];
  if (args.flags.place) scriptArgs.push('--place', args.flags.place);
  if (args.booleans.has('dry-run')) scriptArgs.push('--dry-run');

  console.log(header('Running Blueprint Sync'));
  try {
    await execInherit('node', scriptArgs, ROOT);
    console.log(ok('Sync completed'));
  } catch (e) {
    console.log(err(`Sync failed: ${e.message}`));
    process.exit(1);
  }
}

async function cmdWatch(args) {
  const spin = new Spinner('Resolving place context...').start();
  const context = await resolveContext(args);
  spin.succeed(`Resolved: ${context.place ? context.place.displayName : 'legacy'}`);

  const status = await getStatus('prop-watch');
  if (status.running) {
    console.log(`${running('Property watcher')} already running (pid ${status.pid})`);
    return;
  }

  const s = new Spinner('Starting property watcher...').start();
  const scriptArgs = ['scripts/watch-roblox-properties.mjs'];
  if (args.flags.place) scriptArgs.push('--place', args.flags.place);
  if (args.booleans.has('dry-run')) scriptArgs.push('--dry-run');

  run('prop-watch', 'node', scriptArgs, ROOT, { stdio: 'inherit' });
  s.succeed('Property watcher started');
}

async function cmdBuild(args) {
  const spin = new Spinner('Resolving place context...').start();
  const context = await resolveContext(args);
  spin.succeed(`Resolved: ${context.place ? context.place.displayName : 'legacy'}`);

  if (!hasCommand('rojo')) {
    console.log(`${err('rojo not found')} Install with: cargo install rojo`);
    process.exit(1);
  }

  const output = args.flags.output || 'build.rbxl';
  console.log(header(`Building ${output}`));

  try {
    await execInherit('rojo', ['build', context.paths.project, '-o', output], ROOT);
    console.log(ok(`Built: ${output}`));
  } catch (e) {
    console.log(err(`Build failed: ${e.message}`));
    process.exit(1);
  }
}

async function cmdLint(args) {
  const strict = args.booleans.has('strict');
  const failOnFindings = args.booleans.has('fail-on-findings');

  console.log(header('Running Luau Lint'));
  const scriptArgs = ['scripts/luau-lint.mjs'];
  if (strict) scriptArgs.push('--strict');
  if (failOnFindings) scriptArgs.push('--fail-on-findings');

  try {
    await execInherit('node', scriptArgs, ROOT);
    console.log(ok('Lint completed'));
  } catch (e) {
    console.log(err(`Lint failed: ${e.message}`));
    process.exit(1);
  }
}

async function cmdPlace(args) {
  const sub = args.subcommand || 'status';

  if (sub === 'list') {
    const registry = await loadRegistry();
    const active = await loadActiveSelection();
    const places = listPlaces(registry);

    if (args.booleans.has('json')) {
      console.log(JSON.stringify({ active, places }, null, 2));
      return;
    }

    if (places.length === 0) {
      console.log(drawBox([
        'No registered places yet.',
        '',
        `${c.dim}Run:${c.reset} studio place detect --init-if-missing --set-active`,
      ], { color: c.yellow }));
      return;
    }

    const rows = places.map((p) => {
      const isActive = String(p.placeId) === String(active?.placeId || '');
      const marker = isActive ? c.brightGreen + '●' + c.reset : c.gray + '○' + c.reset;
      const tags = Array.isArray(p.tags) && p.tags.length > 0 ? p.tags.join(',') : c.dim + '-' + c.reset;
      return [
        marker,
        c.bold + p.displayName + c.reset,
        c.dim + p.slug + c.reset,
        String(p.placeId),
        tags,
        c.dim + (p.lastSeenAt ? p.lastSeenAt.slice(0, 10) : '-') + c.reset,
      ];
    });

    console.log(drawTable(rows, {
      headers: ['', 'Name', 'Slug', 'PlaceId', 'Tags', 'Last Seen'],
      color: c.brightCyan,
    }));
    return;
  }

  if (sub === 'status') {
    const context = await resolvePlaceContext({
      placeKey: args.flags.place,
      autoDetect: true,
      useActive: true,
      allowLegacy: true,
    });
    const active = await loadActiveSelection();
    let detected = null;
    try { detected = await (await import('./lib/place-context.mjs')).getCurrentPlaceInfo(); } catch { /* ignore */ }

    if (args.booleans.has('json')) {
      console.log(JSON.stringify({ mode: context.mode, detected, active, place: context.place, paths: context.paths }, null, 2));
      return;
    }

    const lines = [
      `${c.bold}Mode:${c.reset}        ${context.mode === 'place' ? c.brightCyan + context.mode + c.reset : c.dim + context.mode + c.reset}`,
    ];
    if (detected) {
      lines.push(`${c.bold}Detected:${c.reset}    ${detected.placeName} (${detected.placeId})`);
    } else {
      lines.push(`${c.bold}Detected:${c.reset}    ${c.dim}unavailable${c.reset}`);
    }
    if (active) {
      lines.push(`${c.bold}Active:${c.reset}      ${active.displayName} (${active.placeId}) [${active.slug}]`);
    } else {
      lines.push(`${c.bold}Active:${c.reset}      ${c.dim}none${c.reset}`);
    }
    if (context.place) {
      lines.push(`${c.bold}Resolved:${c.reset}    ${context.place.displayName} (${context.place.placeId})`);
    }
    lines.push(`${c.bold}Project:${c.reset}     ${context.paths.project}`);
    lines.push(`${c.bold}Source:${c.reset}      ${context.paths.src}`);
    lines.push(`${c.bold}Properties:${c.reset}  ${context.paths.propertiesFile}`);

    console.log(drawBox(lines, { title: 'Place Context', color: c.brightCyan }));
    return;
  }

  if (sub === 'use') {
    const key = args.positionals[0];
    if (!key) {
      console.log(err('Usage: studio place use <placeId|slug|displayName>'));
      process.exit(1);
    }
    const { place } = await setActivePlaceByKey(key);
    console.log(ok(`Active place: ${place.displayName} (${place.placeId}) [${place.slug}]`));
    return;
  }

  if (sub === 'detect') {
    const initIfMissing = args.booleans.has('init-if-missing');
    const setActive = args.booleans.has('set-active');
    const { getCurrentPlaceInfo, registerCurrentPlace, setActiveSelection, findPlace, loadRegistry, saveRegistry } = await import('./lib/place-context.mjs');

    const s = new Spinner('Detecting Studio place...').start();
    const placeInfo = await getCurrentPlaceInfo();
    s.succeed(`Detected: ${placeInfo.placeName} (${place.placeId})`);

    const registry = await loadRegistry();
    const existing = findPlace(registry, String(placeInfo.placeId));

    if (!existing && !initIfMissing) {
      console.log(warn('Place not registered. Run with --init-if-missing --set-active'));
      return;
    }

    if (!existing && initIfMissing) {
      const result = await registerCurrentPlace({});
      if (setActive) {
        await setActiveSelection(result.place);
        console.log(ok(`Registered & activated: ${result.place.displayName} [${result.place.slug}]`));
      } else {
        console.log(ok(`Registered: ${result.place.displayName} [${result.place.slug}]`));
      }
      return;
    }

    existing.lastSeenAt = new Date().toISOString();
    registry.places[String(existing.placeId)] = existing;
    await saveRegistry(registry);
    if (setActive) {
      await setActiveSelection(existing);
      console.log(ok(`Updated & activated: ${existing.displayName} [${existing.slug}]`));
    } else {
      console.log(ok(`Updated: ${existing.displayName} [${existing.slug}]`));
    }
    return;
  }

  console.log(err(`Unknown place subcommand: ${sub}`));
  console.log('Try: studio place list | status | use <key> | detect [--init-if-missing --set-active]');
  process.exit(1);
}

async function cmdStatus(args) {
  const verbose = args.booleans.has('verbose');
  const tracked = await listTracked();

  console.log(logo());
  console.log();

  // Process table
  const procRows = tracked.map((t) => {
    const status = t.running
      ? running('running')
      : stopped('stopped');
    const uptime = t.running && t.startedAt
      ? formatUptime(Date.now() - new Date(t.startedAt).getTime())
      : '-';
    return [
      c.bold + t.name + c.reset,
      status,
      t.pid ? String(t.pid) : c.dim + '-' + c.reset,
      uptime,
    ];
  });

  if (procRows.length === 0) {
    console.log(drawBox([
      `${c.dim}No tracked processes. Start something with:${c.reset}`,
      '',
      '  studio dev     studio mcp     studio serve',
    ], { title: 'Processes', color: c.yellow }));
  } else {
    console.log(drawTable(procRows, {
      headers: ['Process', 'Status', 'PID', 'Uptime'],
      color: c.brightCyan,
    }));
  }

  // MCP health
  console.log();
  const healthS = new Spinner('Checking MCP health...').start();
  let health = null;
  try {
    const res = await fetch(`${MCP_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    health = await res.json();
    healthS.succeed('MCP health check passed');
  } catch {
    healthS.fail('MCP unreachable');
  }

  if (health) {
    const lines = [
      `${c.bold}Plugin:${c.reset}      ${health.pluginConnected ? ok('connected') : err('disconnected')}`,
      `${c.bold}MCP Server:${c.reset}  ${health.mcpServerActive ? ok('active') : err('inactive')}`,
      `${c.bold}Version:${c.reset}     ${health.plugin?.version || c.dim + 'unknown' + c.reset}`,
    ];
    if (health.bridge?.p90LatencyMs) {
      lines.push(`${c.bold}Latency:${c.reset}     ${health.bridge.p90LatencyMs}ms p90`);
    }
    console.log(drawBox(lines, { title: 'MCP Health', color: c.brightGreen }));
  }

  // Place context
  console.log();
  try {
    const context = await resolvePlaceContext({ autoDetect: true, useActive: true, allowLegacy: true });
    const lines = [
      `${c.bold}Mode:${c.reset}     ${context.mode}`,
      context.place
        ? `${c.bold}Place:${c.reset}    ${context.place.displayName} (${context.place.placeId})`
        : `${c.bold}Place:${c.reset}    ${c.dim}legacy blueprint-v1${c.reset}`,
      `${c.bold}Project:${c.reset}  ${path.relative(ROOT, context.paths.project)}`,
    ];
    console.log(drawBox(lines, { title: 'Place Context', color: c.brightMagenta }));
  } catch (e) {
    console.log(warn(`No place context: ${e.message}`));
  }

  // Rojo check
  if (verbose) {
    console.log();
    const rojoS = new Spinner('Checking Rojo...').start();
    try {
      const res = await fetch('http://127.0.0.1:34872/api/health', { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        rojoS.succeed('Rojo server responding');
      } else {
        rojoS.fail(`Rojo returned ${res.status}`);
      }
    } catch {
      rojoS.fail('Rojo not running');
    }
  }
}

async function cmdStop(args) {
  const target = args.positionals[0];

  if (target) {
    const s = new Spinner(`Stopping ${target}...`).start();
    const result = await stopProcess(target);
    if (result.stopped) {
      s.succeed(`Stopped ${target}`);
    } else if (result.wasDead) {
      s.warn(`${target} was already dead`);
    } else {
      s.fail(`${target} not tracked`);
    }
    return;
  }

  const tracked = await listTracked();
  const running = tracked.filter((t) => t.running);

  if (running.length === 0) {
    console.log(info('No running processes to stop'));
    return;
  }

  console.log(header('Stopping All Processes'));
  for (const t of running) {
    const s = new Spinner(`Stopping ${t.name}...`).start();
    const result = await stopProcess(t.name);
    if (result.stopped) {
      s.succeed(`Stopped ${t.name}`);
    } else {
      s.fail(`Failed to stop ${t.name}`);
    }
  }
  console.log(ok('All processes stopped'));
}

async function cmdTranscribe(args) {
  console.log(header('Whisper Transcription'));
  try {
    await execInherit('node', ['scripts/transcribe-whisper.mjs'], ROOT);
  } catch (e) {
    console.log(err(`Transcription failed: ${e.message}`));
    process.exit(1);
  }
}

async function cmdDoctor(args) {
  console.log(header('Blueprint Doctor'));
  try {
    await execInherit('node', ['scripts/blueprint-doctor.mjs'], ROOT);
  } catch (e) {
    console.log(err(`Doctor failed: ${e.message}`));
    process.exit(1);
  }
}

async function cmdVersion() {
  const version = await getVersion();
  console.log(logo());
  console.log();
  console.log(`  Version: ${c.bold}${version}${c.reset}`);
  console.log(`  Node:    ${process.version}`);
  console.log(`  Root:    ${ROOT}`);
}

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) return `${hrs}h${mins % 60}m`;
  if (mins > 0) return `${mins}m${seconds % 60}s`;
  return `${seconds}s`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Help
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function printHelp() {
  console.log(logo());
  console.log();
  console.log(drawBox([
    `${c.bold}studio dev${c.reset}              ${c.dim}Start full dev environment (MCP + Rojo + Watch + Reverse)${c.reset}`,
    `${c.bold}studio serve${c.reset}            ${c.dim}Start Rojo server only${c.reset}`,
    `${c.bold}studio mcp${c.reset}              ${c.dim}Start MCP server only${c.reset}`,
    `${c.bold}studio sync${c.reset}             ${c.dim}Run Blueprint property sync once${c.reset}`,
    `${c.bold}studio watch${c.reset}            ${c.dim}Start property file watcher${c.reset}`,
    `${c.bold}studio build${c.reset}            ${c.dim}Build place file via Rojo${c.reset}`,
    `${c.bold}studio lint${c.reset}             ${c.dim}Run Luau linting${c.reset}`,
    `${c.bold}studio place list${c.reset}       ${c.dim}List registered places${c.reset}`,
    `${c.bold}studio place status${c.reset}     ${c.dim}Show resolved place context${c.reset}`,
    `${c.bold}studio place use <key>${c.reset}  ${c.dim}Set active place${c.reset}`,
    `${c.bold}studio place detect${c.reset}     ${c.dim}Detect current Studio place${c.reset}`,
    `${c.bold}studio status${c.reset}           ${c.dim}Show system status${c.reset}`,
    `${c.bold}studio stop [name]${c.reset}      ${c.dim}Stop tracked process(es)${c.reset}`,
    `${c.bold}studio transcribe${c.reset}       ${c.dim}Run Whisper transcription${c.reset}`,
    `${c.bold}studio doctor${c.reset}           ${c.dim}Run Blueprint doctor${c.reset}`,
    `${c.bold}studio version${c.reset}          ${c.dim}Show version info${c.reset}`,
  ], { title: 'Commands', color: c.brightCyan }));
  console.log();
  console.log(drawBox([
    `${c.bold}--place <key>${c.reset}     ${c.dim}Target place (slug/id/name)${c.reset}`,
    `${c.bold}--verbose${c.reset}         ${c.dim}Show process output${c.reset}`,
    `${c.bold}--json${c.reset}            ${c.dim}Machine-readable output${c.reset}`,
    `${c.bold}--dry-run${c.reset}         ${c.dim}Preview changes without applying${c.reset}`,
  ], { title: 'Global Flags', color: c.brightMagenta }));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main Router
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.booleans.has('version') || args.command === 'version' || args.command === '-v' || args.command === '--version') {
    await cmdVersion();
    return;
  }

  if (args.booleans.has('help') || !args.command || args.command === 'help') {
    printHelp();
    return;
  }

  const commands = {
    dev: cmdDev,
    serve: cmdServe,
    mcp: cmdMcp,
    sync: cmdSync,
    watch: cmdWatch,
    build: cmdBuild,
    lint: cmdLint,
    place: cmdPlace,
    status: cmdStatus,
    stop: cmdStop,
    transcribe: cmdTranscribe,
    doctor: cmdDoctor,
  };

  const handler = commands[args.command];
  if (!handler) {
    console.log(err(`Unknown command: ${args.command}`));
    console.log('Run studio --help for usage');
    process.exit(1);
  }

  await handler(args);
}

main().catch((error) => {
  console.error(err(error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
