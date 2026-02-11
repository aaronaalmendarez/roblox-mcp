#!/usr/bin/env node

import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const API_BASE = 'https://api.github.com/repos/luau-lang/luau/releases';
const DEFAULT_INSTALL_DIR = '.tools/luau';

function parseArgs(argv) {
  const args = {
    version: 'latest',
    installDir: DEFAULT_INSTALL_DIR,
    force: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--version' && argv[i + 1]) {
      args.version = argv[i + 1];
      i += 1;
    } else if (token === '--dir' && argv[i + 1]) {
      args.installDir = argv[i + 1];
      i += 1;
    } else if (token === '--force') {
      args.force = true;
    }
  }

  return args;
}

function getPlatformAssetName() {
  if (process.platform === 'win32') {
    return 'luau-windows.zip';
  }
  if (process.platform === 'darwin') {
    return 'luau-macos.zip';
  }
  if (process.platform === 'linux') {
    return 'luau-ubuntu.zip';
  }
  throw new Error(`Unsupported platform: ${process.platform}`);
}

async function fetchRelease(version) {
  const endpoint = version === 'latest'
    ? `${API_BASE}/latest`
    : `${API_BASE}/tags/${encodeURIComponent(version)}`;

  const res = await fetch(endpoint, {
    headers: { 'User-Agent': 'rblxmcp-luau-installer' },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Failed to parse GitHub API response: ${text}`);
  }

  if (!res.ok) {
    throw new Error(`GitHub API failed (${res.status}): ${JSON.stringify(data)}`);
  }

  return data;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function runCommand(command, args, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: false,
      env: process.env,
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(undefined);
      } else {
        reject(new Error(`${command} exited with code ${String(code)}`));
      }
    });
  });
}

async function extractZip(zipPath, outDir) {
  await fs.mkdir(outDir, { recursive: true });

  if (process.platform === 'win32') {
    await runCommand('powershell', [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${outDir.replace(/'/g, "''")}' -Force`,
    ], process.cwd());
    return;
  }

  await runCommand('unzip', ['-o', zipPath, '-d', outDir], process.cwd());
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const assetName = getPlatformAssetName();
  const installRoot = path.resolve(process.cwd(), args.installDir);

  const release = await fetchRelease(args.version);
  const version = release.tag_name;
  if (!version) {
    throw new Error('Release tag_name is missing in GitHub response.');
  }

  const asset = (release.assets || []).find((x) => x.name === assetName);
  if (!asset) {
    throw new Error(`Asset ${assetName} not found in release ${version}.`);
  }

  const versionDir = path.join(installRoot, version, process.platform);
  const currentDir = path.join(installRoot, 'current', process.platform);
  const binName = process.platform === 'win32' ? 'luau-analyze.exe' : 'luau-analyze';
  const existingBin = path.join(versionDir, binName);

  if (!args.force && fssync.existsSync(existingBin)) {
    console.log(`Luau ${version} already installed at ${versionDir}`);
  } else {
    await fs.mkdir(versionDir, { recursive: true });

    const zipPath = path.join(versionDir, asset.name);
    const res = await fetch(asset.browser_download_url, {
      headers: { 'User-Agent': 'rblxmcp-luau-installer' },
    });
    if (!res.ok) {
      throw new Error(`Failed to download ${asset.browser_download_url} (${res.status})`);
    }

    const fileBuf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(zipPath, fileBuf);

    if (typeof asset.digest === 'string' && asset.digest.startsWith('sha256:')) {
      const expected = asset.digest.slice('sha256:'.length);
      const actual = sha256(fileBuf);
      if (actual !== expected) {
        throw new Error(`SHA256 mismatch for ${asset.name}. expected=${expected} actual=${actual}`);
      }
      console.log(`SHA256 verified: ${asset.name}`);
    } else {
      console.log('Warning: no digest metadata found; skipping checksum verification.');
    }

    const extractDir = path.join(versionDir, 'bin');
    await extractZip(zipPath, extractDir);
    await fs.unlink(zipPath);
    console.log(`Installed Luau ${version} to ${extractDir}`);
  }

  const sourceBinDir = path.join(versionDir, 'bin');
  if (!fssync.existsSync(sourceBinDir)) {
    throw new Error(`Installed binary directory missing: ${sourceBinDir}`);
  }

  await fs.rm(currentDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(currentDir), { recursive: true });
  await fs.cp(sourceBinDir, currentDir, { recursive: true });

  const manifest = {
    version,
    platform: process.platform,
    installedAt: new Date().toISOString(),
    path: currentDir,
  };
  await fs.writeFile(path.join(installRoot, 'current.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(`Current Luau toolchain set to ${version}`);
  console.log(`Analyzer path: ${path.join(currentDir, binName)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

