// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  studio-cli Process Manager — PID tracking, spawn, kill, status          ║
// ║  Cross-platform. No orphaned processes. Log capture. Graceful shutdown.   ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_DIR = path.join(__dirname, '..', '..', '.studio-cli');
const PID_DIR = path.join(STUDIO_DIR, 'pids');
const LOG_DIR = path.join(STUDIO_DIR, 'logs');

function pidFile(name) {
  return path.join(PID_DIR, `${name}.pid`);
}

function logFile(name) {
  return path.join(LOG_DIR, `${name}.log`);
}

async function ensureDirs() {
  await fs.mkdir(PID_DIR, { recursive: true });
  await fs.mkdir(LOG_DIR, { recursive: true });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PID I/O
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function writePid(name, pid, meta = {}) {
  await ensureDirs();
  const data = { pid, startedAt: new Date().toISOString(), ...meta };
  await fs.writeFile(pidFile(name), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export async function readPid(name) {
  try {
    const raw = await fs.readFile(pidFile(name), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function removePid(name) {
  try {
    await fs.unlink(pidFile(name));
  } catch {
    // ignore
  }
}

export function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function getStatus(name) {
  const data = await readPid(name);
  if (!data) return { running: false, pid: null, startedAt: null };
  const alive = isAlive(data.pid);
  if (!alive) {
    await removePid(name);
    return { running: false, pid: data.pid, startedAt: data.startedAt };
  }
  return { running: true, pid: data.pid, startedAt: data.startedAt, ...data };
}

export async function listTracked() {
  await ensureDirs();
  const files = await fs.readdir(PID_DIR).catch(() => []);
  const out = [];
  for (const f of files) {
    if (!f.endsWith('.pid')) continue;
    const name = f.slice(0, -4);
    const status = await getStatus(name);
    out.push({ name, ...status });
  }
  return out;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Cross-platform tree kill
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function killTree(pid, signal = 'SIGTERM') {
  const isWin = process.platform === 'win32';
  try {
    if (isWin) {
      // /T = kill tree, /F = force if needed
      execSync(`taskkill /T /PID ${pid}`, { stdio: 'ignore' });
    } else {
      process.kill(pid, signal);
    }
  } catch {
    // ignore
  }
}

function forceKill(pid) {
  const isWin = process.platform === 'win32';
  try {
    if (isWin) {
      execSync(`taskkill /T /F /PID ${pid}`, { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGKILL');
    }
  } catch {
    // ignore
  }
}

export async function stopProcess(name) {
  const data = await readPid(name);
  if (!data) return { stopped: false, reason: 'not tracked' };
  if (!isAlive(data.pid)) {
    await removePid(name);
    return { stopped: false, wasDead: true };
  }

  killTree(data.pid, 'SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 2000));

  if (isAlive(data.pid)) {
    forceKill(data.pid);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  await removePid(name);
  return { stopped: true, pid: data.pid };
}

export async function stopAll() {
  const tracked = await listTracked();
  const results = [];
  for (const t of tracked) {
    if (t.running) {
      results.push({ name: t.name, ...(await stopProcess(t.name)) });
    }
  }
  return results;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Spawn with log capture — shell:false to track real PIDs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function createLogStream(name) {
  const lf = logFile(name);
  ensureDirs();
  return fssync.createWriteStream(lf, { flags: 'a' });
}

export function run(name, command, args, cwd, opts = {}) {
  const { onExit, env = process.env, stdio = 'pipe', captureLogs = true } = opts;

  const logOut = captureLogs && stdio === 'pipe' ? createLogStream(name) : null;
  const child = spawn(command, args, {
    cwd,
    stdio: stdio === 'inherit' ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    shell: false,
    env,
    windowsHide: true,
  });

  writePid(name, child.pid, { command: `${command} ${args.join(' ')}`, cwd });

  if (logOut && child.stdout) {
    const ts = () => `[${new Date().toISOString()}] `;
    child.stdout.on('data', (d) => logOut.write(ts() + d.toString()));
    child.stderr.on('data', (d) => logOut.write(ts() + '[ERR] ' + d.toString()));
  }

  child.on('exit', (code) => {
    if (logOut) {
      logOut.write(`[${new Date().toISOString()}] [EXIT] code=${code}\n`);
      logOut.end();
    }
    removePid(name);
    if (onExit) onExit(code);
  });

  return child;
}

export function runDetached(name, command, args, cwd, opts = {}) {
  const { onExit, env = process.env, captureLogs = true } = opts;

  const logOut = captureLogs ? createLogStream(name) : null;
  const child = spawn(command, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    env,
    windowsHide: true,
    detached: true,
  });

  child.unref();
  writePid(name, child.pid, { command: `${command} ${args.join(' ')}`, cwd, detached: true });

  if (logOut && child.stdout) {
    const ts = () => `[${new Date().toISOString()}] `;
    child.stdout.on('data', (d) => logOut.write(ts() + d.toString()));
    child.stderr.on('data', (d) => logOut.write(ts() + '[ERR] ' + d.toString()));
  }

  child.on('exit', (code) => {
    if (logOut) {
      logOut.write(`[${new Date().toISOString()}] [EXIT] code=${code}\n`);
      logOut.end();
    }
    removePid(name);
    if (onExit) onExit(code);
  });

  return child;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Log tail utility
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function tailLog(name, lines = 20) {
  const lf = logFile(name);
  try {
    const raw = await fs.readFile(lf, 'utf8');
    const all = raw.split('\n');
    return all.slice(-lines).join('\n');
  } catch {
    return '';
  }
}

export async function streamLog(name, onLine) {
  const lf = logFile(name);
  try {
    await fs.access(lf);
  } catch {
    return;
  }
  const stream = fssync.createReadStream(lf);
  const rl = createInterface({ input: stream });
  for await (const line of rl) {
    onLine(line);
  }
}
