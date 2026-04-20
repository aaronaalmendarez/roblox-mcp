// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  studio-cli Process Manager — PID tracking, spawn, kill, status          ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PID_DIR = path.join(__dirname, '..', '..', '.studio-cli', 'pids');

function pidFile(name) {
  return path.join(PID_DIR, `${name}.pid`);
}

async function ensurePidDir() {
  await fs.mkdir(PID_DIR, { recursive: true });
}

export async function writePid(name, pid, meta = {}) {
  await ensurePidDir();
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
  await ensurePidDir();
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

export async function stopProcess(name) {
  const data = await readPid(name);
  if (!data) return { stopped: false, reason: 'not tracked' };
  if (!isAlive(data.pid)) {
    await removePid(name);
    return { stopped: false, wasDead: true };
  }
  try {
    process.kill(data.pid, 'SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 1500));
    if (isAlive(data.pid)) {
      process.kill(data.pid, 'SIGKILL');
    }
  } catch {
    // ignore
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

export function run(name, command, args, cwd, opts = {}) {
  const { onExit, env = process.env, stdio = 'pipe' } = opts;
  const child = spawn(command, args, {
    cwd,
    stdio,
    shell: true,
    env,
    windowsHide: true,
  });

  writePid(name, child.pid, { command: [command, ...args].join(' '), cwd });

  child.on('exit', (code) => {
    removePid(name);
    if (onExit) onExit(code);
  });

  return child;
}

export function runDetached(name, command, args, cwd, opts = {}) {
  const { onExit, env = process.env } = opts;
  const child = spawn(command, args, {
    cwd,
    stdio: 'ignore',
    shell: true,
    env,
    windowsHide: true,
    detached: true,
  });

  child.unref();
  writePid(name, child.pid, { command: [command, ...args].join(' '), cwd, detached: true });

  child.on('exit', (code) => {
    removePid(name);
    if (onExit) onExit(code);
  });

  return child;
}

export async function tailLog(name, lines = 20) {
  const logFile = path.join(__dirname, '..', '..', '.studio-cli', 'logs', `${name}.log`);
  try {
    const raw = await fs.readFile(logFile, 'utf8');
    const all = raw.split('\n');
    return all.slice(-lines).join('\n');
  } catch {
    return '';
  }
}
