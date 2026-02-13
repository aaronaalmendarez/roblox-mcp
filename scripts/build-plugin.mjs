#!/usr/bin/env node

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const { version: VERSION } = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
const pluginDir = join(rootDir, 'studio-plugin');
const outDir = join(pluginDir, 'out');
const serverDir = join(outDir, 'server');
const modulesDir = join(outDir, 'modules');
const includeDir = join(pluginDir, 'include');
const nodeModulesRbxtsDir = join(pluginDir, 'node_modules', '@rbxts');
const outputPath = join(pluginDir, 'MCPPlugin.rbxmx');

function escapeCdata(source) {
  return source.replace(/\]\]>/g, ']]]]><![CDATA[>');
}

function injectVersion(source) {
  return source.replace(/__VERSION__/g, VERSION);
}

const serverInitPath = join(serverDir, 'init.server.luau');
if (!existsSync(serverInitPath)) {
  console.error(`Server script not found at ${serverInitPath}`);
  console.error('Run "cd studio-plugin && npm run build" first to compile TypeScript.');
  process.exit(1);
}

const mainSource = injectVersion(readFileSync(serverInitPath, 'utf8'));

let refId = 1;

function findInitFile(dir) {
  for (const name of ['init.luau', 'init.lua']) {
    const p = join(dir, name);
    if (existsSync(p)) return p;
  }
  return undefined;
}

const INIT_FILENAMES = new Set(['init.luau', 'init.lua', 'init.server.luau', 'init.server.lua']);

function isLuaFile(name) {
  return name.endsWith('.luau') || name.endsWith('.lua');
}

function dirHasLuaContent(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && isLuaFile(entry.name)) return true;
    if (entry.isDirectory() && dirHasLuaContent(join(dir, entry.name))) return true;
  }
  return false;
}

function buildModuleItems(dir, depth = 0) {
  if (!existsSync(dir)) return '';

  let items = '';
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!dirHasLuaContent(fullPath)) continue;

      const initFile = findInitFile(fullPath);
      refId++;
      const currentRef = refId;

      if (initFile) {
        const moduleSource = injectVersion(readFileSync(initFile, 'utf8'));
        const childItems = buildModuleItems(fullPath, depth + 1);
        items += `
      ${'  '.repeat(depth)}<Item class="ModuleScript" referent="${currentRef}">
      ${'  '.repeat(depth)}  <Properties>
      ${'  '.repeat(depth)}    <string name="Name">${entry.name}</string>
      ${'  '.repeat(depth)}    <string name="Source"><![CDATA[${escapeCdata(moduleSource)}]]></string>
      ${'  '.repeat(depth)}  </Properties>${childItems}
      ${'  '.repeat(depth)}</Item>`;
      } else {
        const childItems = buildModuleItems(fullPath, depth + 1);
        items += `
      ${'  '.repeat(depth)}<Item class="Folder" referent="${currentRef}">
      ${'  '.repeat(depth)}  <Properties>
      ${'  '.repeat(depth)}    <string name="Name">${entry.name}</string>
      ${'  '.repeat(depth)}  </Properties>${childItems}
      ${'  '.repeat(depth)}</Item>`;
      }
    } else if (isLuaFile(entry.name) && !INIT_FILENAMES.has(entry.name)) {
      const ext = entry.name.endsWith('.luau') ? '.luau' : '.lua';
      const moduleName = basename(entry.name, ext);
      const moduleSource = injectVersion(readFileSync(fullPath, 'utf8'));
      refId++;
      items += `
      ${'  '.repeat(depth)}<Item class="ModuleScript" referent="${refId}">
      ${'  '.repeat(depth)}  <Properties>
      ${'  '.repeat(depth)}    <string name="Name">${moduleName}</string>
      ${'  '.repeat(depth)}    <string name="Source"><![CDATA[${escapeCdata(moduleSource)}]]></string>
      ${'  '.repeat(depth)}  </Properties>
      ${'  '.repeat(depth)}</Item>`;
    }
  }

  return items;
}

const moduleItems = buildModuleItems(modulesDir);

const includeItems = buildModuleItems(includeDir);

const rbxtsItems = buildModuleItems(nodeModulesRbxtsDir);

function countModules(dir) {
  if (!existsSync(dir)) return 0;
  let count = 0;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += countModules(join(dir, entry.name));
      if (findInitFile(join(dir, entry.name))) count++;
    } else if (isLuaFile(entry.name) && !INIT_FILENAMES.has(entry.name)) {
      count++;
    }
  }
  return count;
}

const rbxmx = `<?xml version="1.0" encoding="utf-8"?>
<roblox version="4">
  <Item class="Script" referent="0">
    <Properties>
      <string name="Name">MCPPlugin</string>
      <token name="RunContext">0</token>
      <string name="Source"><![CDATA[${escapeCdata(mainSource)}]]></string>
    </Properties>
    <Item class="Folder" referent="1">
      <Properties>
        <string name="Name">modules</string>
      </Properties>${moduleItems}
    </Item>${includeItems ? `
    <Item class="Folder" referent="${++refId}">
      <Properties>
        <string name="Name">include</string>
      </Properties>${includeItems}
    </Item>` : ''}${rbxtsItems ? `
    <Item class="Folder" referent="${++refId}">
      <Properties>
        <string name="Name">node_modules</string>
      </Properties>
      <Item class="Folder" referent="${++refId}">
        <Properties>
          <string name="Name">@rbxts</string>
        </Properties>${rbxtsItems}
      </Item>
    </Item>` : ''}
  </Item>
</roblox>
`;

writeFileSync(outputPath, rbxmx, 'utf8');
const moduleCount = countModules(modulesDir);
const includeCount = countModules(includeDir);
const rbxtsCount = countModules(nodeModulesRbxtsDir);
console.log(`Built studio-plugin/MCPPlugin.rbxmx (${moduleCount} modules${includeCount > 0 ? `, ${includeCount} runtime includes` : ''}${rbxtsCount > 0 ? `, ${rbxtsCount} @rbxts packages` : ''})`);
