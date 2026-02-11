#!/usr/bin/env node

import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import fetch from 'node-fetch';

const BLUEPRINT_ROOT = path.join('blueprint-v1');
const PLACES_ROOT = path.join(BLUEPRINT_ROOT, 'places');
const REGISTRY_FILE = path.join(PLACES_ROOT, 'registry.json');
const ACTIVE_FILE = path.join(PLACES_ROOT, '.active-place.json');
const MCP_BASE = (process.env.ROBLOX_MCP_URL || 'http://localhost:3002').replace(/\/$/, '');

function nowIso() {
  return new Date().toISOString();
}

export function normalizeTags(tags) {
  const set = new Set();
  for (const tag of tags || []) {
    const normalized = String(tag || '').trim().toLowerCase();
    if (normalized) {
      set.add(normalized);
    }
  }
  return [...set];
}

export function parseTagArg(raw) {
  if (!raw) {
    return [];
  }
  return normalizeTags(String(raw).split(',').map((x) => x.trim()));
}

export function slugify(input) {
  const normalized = String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return normalized || 'place';
}

function buildLegacyPaths() {
  return {
    mode: 'legacy',
    root: path.join(BLUEPRINT_ROOT),
    project: path.join(BLUEPRINT_ROOT, 'default.project.json'),
    src: path.join(BLUEPRINT_ROOT, 'src'),
    propertiesDir: path.join(BLUEPRINT_ROOT, 'properties'),
    propertiesFile: path.join(BLUEPRINT_ROOT, 'properties', 'instances.json'),
    stateFile: path.join(BLUEPRINT_ROOT, '.reverse-sync-state.json'),
    conflictDir: path.join(BLUEPRINT_ROOT, '.reverse-sync-conflicts'),
  };
}

export function buildPlacePaths(slug) {
  const root = path.join(PLACES_ROOT, slug);
  return {
    mode: 'place',
    root,
    project: path.join(root, 'default.project.json'),
    src: path.join(root, 'src'),
    propertiesDir: path.join(root, 'properties'),
    propertiesFile: path.join(root, 'properties', 'instances.json'),
    stateFile: path.join(root, '.reverse-sync-state.json'),
    conflictDir: path.join(root, '.reverse-sync-conflicts'),
  };
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function exists(filePath) {
  try {
    await fs.access(filePath, fssync.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function loadRegistry() {
  if (!(await exists(REGISTRY_FILE))) {
    return {
      version: 1,
      places: {},
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
  }
  const registry = await readJson(REGISTRY_FILE);
  if (!registry || typeof registry !== 'object') {
    throw new Error('Invalid places registry format.');
  }
  if (!registry.places || typeof registry.places !== 'object') {
    registry.places = {};
  }
  if (!registry.version) {
    registry.version = 1;
  }
  return registry;
}

export async function saveRegistry(registry) {
  registry.updatedAt = nowIso();
  await writeJson(REGISTRY_FILE, registry);
}

export function listPlaces(registry) {
  const places = Object.values(registry.places || {});
  places.sort((a, b) => {
    const aSeen = typeof a?.lastSeenAt === 'string' ? a.lastSeenAt : '';
    const bSeen = typeof b?.lastSeenAt === 'string' ? b.lastSeenAt : '';
    return bSeen.localeCompare(aSeen);
  });
  return places;
}

export function findPlace(registry, key) {
  if (!key) {
    return null;
  }
  const places = listPlaces(registry);
  const normalized = String(key).trim().toLowerCase();
  for (const place of places) {
    if (String(place.placeId) === normalized) {
      return place;
    }
    if (String(place.slug || '').toLowerCase() === normalized) {
      return place;
    }
    if (String(place.displayName || '').toLowerCase() === normalized) {
      return place;
    }
  }
  return null;
}

export async function loadActiveSelection() {
  if (!(await exists(ACTIVE_FILE))) {
    return null;
  }
  try {
    const active = await readJson(ACTIVE_FILE);
    if (!active || typeof active !== 'object') {
      return null;
    }
    return active;
  } catch {
    return null;
  }
}

export async function setActiveSelection(place) {
  const active = {
    placeId: place.placeId,
    slug: place.slug,
    displayName: place.displayName,
    updatedAt: nowIso(),
  };
  await writeJson(ACTIVE_FILE, active);
  return active;
}

export async function getCurrentPlaceInfo() {
  const response = await fetch(`${MCP_BASE}/mcp/get_place_info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Failed to parse get_place_info response: ${text}`);
  }
  if (!response.ok) {
    throw new Error(`get_place_info failed (${response.status}): ${JSON.stringify(parsed)}`);
  }
  let payload = parsed;
  if (Array.isArray(parsed?.content) && parsed.content[0]?.text) {
    payload = JSON.parse(parsed.content[0].text);
  }
  if (!payload || typeof payload.placeId !== 'number') {
    throw new Error(`Unexpected get_place_info payload: ${JSON.stringify(payload)}`);
  }
  return {
    placeId: payload.placeId,
    gameId: typeof payload.gameId === 'number' ? payload.gameId : 0,
    placeName: typeof payload.placeName === 'string' && payload.placeName.trim()
      ? payload.placeName.trim()
      : `Place ${payload.placeId}`,
  };
}

function ensureUniqueSlug(registry, preferred) {
  const used = new Set(listPlaces(registry).map((x) => String(x.slug || '').toLowerCase()));
  const base = slugify(preferred);
  if (!used.has(base)) {
    return base;
  }
  let idx = 2;
  while (used.has(`${base}-${idx}`)) {
    idx += 1;
  }
  return `${base}-${idx}`;
}

function defaultProjectJson(name) {
  return {
    name: name || 'RobloxPlaceBlueprint',
    tree: {
      $className: 'DataModel',
      ReplicatedStorage: { $path: 'src/ReplicatedStorage' },
      ServerScriptService: { $path: 'src/ServerScriptService' },
      ServerStorage: { $path: 'src/ServerStorage' },
      StarterPlayer: {
        StarterPlayerScripts: { $path: 'src/StarterPlayer/StarterPlayerScripts' },
      },
      StarterGui: { $path: 'src/StarterGui' },
      Workspace: { $path: 'src/Workspace' },
    },
  };
}

function defaultInstancesJson() {
  return {
    instances: [],
  };
}

function defaultSchemaJson() {
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'Roblox Blueprint Property Manifest',
    type: 'object',
    required: ['instances'],
    properties: {
      instances: {
        type: 'array',
        items: {
          type: 'object',
          required: ['path'],
          properties: {
            path: {
              type: 'string',
              description: 'Roblox instance path, e.g. game.Workspace.Baseplate',
            },
            properties: {
              type: 'object',
              description: 'Property map applied via set_property',
            },
            attributes: {
              type: 'object',
              description: 'Attribute map applied via set_attribute',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'CollectionService tags applied via add_tag',
            },
          },
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  };
}

export async function scaffoldPlaceFiles(paths, displayName) {
  await fs.mkdir(paths.src, { recursive: true });
  await fs.mkdir(path.join(paths.src, 'ReplicatedStorage'), { recursive: true });
  await fs.mkdir(path.join(paths.src, 'ServerScriptService'), { recursive: true });
  await fs.mkdir(path.join(paths.src, 'ServerStorage'), { recursive: true });
  await fs.mkdir(path.join(paths.src, 'StarterPlayer', 'StarterPlayerScripts'), { recursive: true });
  await fs.mkdir(path.join(paths.src, 'StarterGui'), { recursive: true });
  await fs.mkdir(path.join(paths.src, 'Workspace'), { recursive: true });
  await fs.mkdir(paths.propertiesDir, { recursive: true });
  await fs.mkdir(paths.conflictDir, { recursive: true });

  if (!(await exists(paths.project))) {
    await writeJson(paths.project, defaultProjectJson(displayName));
  }
  if (!(await exists(paths.propertiesFile))) {
    await writeJson(paths.propertiesFile, defaultInstancesJson());
  }
  const schemaFile = path.join(paths.propertiesDir, 'schema.json');
  if (!(await exists(schemaFile))) {
    await writeJson(schemaFile, defaultSchemaJson());
  }
}

export async function registerCurrentPlace(options = {}) {
  const placeInfo = await getCurrentPlaceInfo();
  const registry = await loadRegistry();
  const existing = registry.places[String(placeInfo.placeId)] || null;

  const desiredName = (options.displayName && String(options.displayName).trim())
    || (existing && existing.displayName)
    || placeInfo.placeName;
  const desiredTags = normalizeTags(
    options.tags && options.tags.length > 0
      ? options.tags
      : (existing && Array.isArray(existing.tags) ? existing.tags : [])
  );
  const slugSeed = options.slug || (existing && existing.slug) || desiredName;
  const slug = existing ? existing.slug : ensureUniqueSlug(registry, slugSeed);
  const paths = buildPlacePaths(slug);
  await scaffoldPlaceFiles(paths, desiredName);

  const record = {
    placeId: placeInfo.placeId,
    gameId: placeInfo.gameId,
    slug,
    displayName: desiredName,
    detectedPlaceName: placeInfo.placeName,
    tags: desiredTags,
    createdAt: existing?.createdAt || nowIso(),
    lastSeenAt: nowIso(),
  };

  registry.places[String(placeInfo.placeId)] = record;
  await saveRegistry(registry);

  return {
    registry,
    place: record,
    paths,
    placeInfo,
    wasExisting: Boolean(existing),
  };
}

export async function resolvePlaceContext(options = {}) {
  const {
    placeKey,
    autoDetect = true,
    useActive = true,
    allowLegacy = true,
  } = options;

  const registry = await loadRegistry();

  let selected = null;
  if (placeKey) {
    selected = findPlace(registry, placeKey);
  }

  if (!selected && useActive) {
    const active = await loadActiveSelection();
    if (active && active.placeId !== undefined) {
      selected = findPlace(registry, String(active.placeId));
      if (!selected && active.slug) {
        selected = findPlace(registry, String(active.slug));
      }
    }
  }

  let currentPlaceInfo = null;
  if (!selected && autoDetect) {
    try {
      currentPlaceInfo = await getCurrentPlaceInfo();
      selected = findPlace(registry, String(currentPlaceInfo.placeId));
      if (selected) {
        selected.lastSeenAt = nowIso();
        await saveRegistry(registry);
      }
    } catch {
      // ignore detection failures for non-live workflows
    }
  }

  if (selected) {
    const paths = buildPlacePaths(selected.slug);
    return {
      mode: 'place',
      place: selected,
      paths,
      registry,
      currentPlaceInfo,
    };
  }

  if (allowLegacy) {
    const legacy = buildLegacyPaths();
    if (fssync.existsSync(legacy.project)) {
      return {
        mode: 'legacy',
        place: null,
        paths: legacy,
        registry,
        currentPlaceInfo,
      };
    }
  }

  throw new Error(
    'No active place mapping found. Run: node scripts/places.mjs detect --init-if-missing --set-active'
  );
}

export async function setActivePlaceByKey(placeKey) {
  const registry = await loadRegistry();
  const place = findPlace(registry, placeKey);
  if (!place) {
    throw new Error(`Place not found: ${placeKey}`);
  }
  const active = await setActiveSelection(place);
  return { place, active };
}

