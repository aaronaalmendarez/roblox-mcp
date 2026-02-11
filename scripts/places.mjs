#!/usr/bin/env node

import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import {
  findPlace,
  getCurrentPlaceInfo,
  listPlaces,
  loadActiveSelection,
  loadRegistry,
  normalizeTags,
  parseTagArg,
  registerCurrentPlace,
  resolvePlaceContext,
  saveRegistry,
  setActivePlaceByKey,
  setActiveSelection,
} from './lib/place-context.mjs';

function parseFlags(argv) {
  const out = {
    positionals: [],
    flags: new Map(),
    booleans: new Set(),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out.flags.set(key, next);
        i += 1;
      } else {
        out.booleans.add(key);
      }
      continue;
    }
    out.positionals.push(token);
  }

  return out;
}

function printHelp() {
  console.log([
    'Usage: node scripts/places.mjs <command> [options]',
    '',
    'Commands:',
    '  detect         Detect current Studio place and show mapping status',
    '  init           Register current Studio place in blueprint-v1/places/registry.json',
    '  list           List known place mappings',
    '  use <key>      Set active place by placeId/slug/displayName',
    '  tag add <key> <tags>      Add comma-separated tags to place',
    '  tag remove <key> <tags>   Remove comma-separated tags from place',
    '  status         Show resolved place context for sync scripts',
    '',
    'Common options:',
    '  --place <key>            Explicit place key (for status)',
    '  --name <displayName>     Display name for init/detect --init-if-missing',
    '  --slug <slug>            Slug override for init',
    '  --tags a,b,c             Initial tags (comma-separated)',
    '  --set-active             Set active place after detect/init',
    '  --init-if-missing        For detect: auto-register when unknown',
    '  --json                   Print machine-readable output for detect/list/status',
  ].join('\n'));
}

function isInteractive() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

async function promptNewPlaceDefaults(placeInfo) {
  if (!isInteractive()) {
    return { displayName: placeInfo.placeName, tags: [] };
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const nameRaw = await rl.question(`Name for place ${placeInfo.placeId} [${placeInfo.placeName}]: `);
    const tagsRaw = await rl.question('Tags (comma-separated, optional): ');
    return {
      displayName: (nameRaw || '').trim() || placeInfo.placeName,
      tags: parseTagArg(tagsRaw),
    };
  } finally {
    rl.close();
  }
}

function printPlaceLine(place, activePlaceId) {
  const marker = String(place.placeId) === String(activePlaceId || '') ? '*' : ' ';
  const tags = Array.isArray(place.tags) && place.tags.length > 0 ? place.tags.join(',') : '-';
  console.log(
    `${marker} placeId=${place.placeId} slug=${place.slug} name="${place.displayName}" tags=[${tags}] lastSeen=${place.lastSeenAt || '-'}`
  );
}

async function cmdList(parsed) {
  const registry = await loadRegistry();
  const active = await loadActiveSelection();
  const places = listPlaces(registry);

  if (parsed.booleans.has('json')) {
    console.log(JSON.stringify({
      active,
      places,
    }, null, 2));
    return;
  }

  if (places.length === 0) {
    console.log('No registered places. Run: node scripts/places.mjs init');
    return;
  }

  console.log('Registered places:');
  for (const place of places) {
    printPlaceLine(place, active?.placeId);
  }
}

async function cmdUse(parsed) {
  const key = parsed.positionals[1];
  if (!key) {
    throw new Error('Usage: node scripts/places.mjs use <placeId|slug|displayName>');
  }

  const { place } = await setActivePlaceByKey(key);
  console.log(`Active place set: ${place.displayName} (${place.placeId}) [${place.slug}]`);
}

async function cmdDetect(parsed) {
  const initIfMissing = parsed.booleans.has('init-if-missing');
  const setActive = parsed.booleans.has('set-active');
  const requestedName = parsed.flags.get('name');
  const requestedSlug = parsed.flags.get('slug');
  const requestedTags = parseTagArg(parsed.flags.get('tags'));

  const placeInfo = await getCurrentPlaceInfo();
  const registry = await loadRegistry();
  const existing = findPlace(registry, String(placeInfo.placeId));

  if (!existing && !initIfMissing) {
    const output = {
      detected: placeInfo,
      mapped: false,
      message: 'Current place is not registered. Run: node scripts/places.mjs detect --init-if-missing --set-active',
    };
    if (parsed.booleans.has('json')) {
      console.log(JSON.stringify(output, null, 2));
      return;
    }
    console.log(`Detected place: ${placeInfo.placeName} (${placeInfo.placeId})`);
    console.log('No mapping found. Run: node scripts/places.mjs detect --init-if-missing --set-active');
    return;
  }

  if (!existing && initIfMissing) {
    let name = requestedName;
    let tags = requestedTags;
    if (!name) {
      const prompted = await promptNewPlaceDefaults(placeInfo);
      name = prompted.displayName;
      if (tags.length === 0) {
        tags = prompted.tags;
      }
    }

    const result = await registerCurrentPlace({
      displayName: name,
      slug: requestedSlug,
      tags,
    });

    if (setActive) {
      await setActiveSelection(result.place);
    }

    const output = {
      detected: placeInfo,
      mapped: true,
      created: true,
      place: result.place,
      paths: result.paths,
      activeSet: setActive,
    };
    if (parsed.booleans.has('json')) {
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    console.log(`Detected place: ${placeInfo.placeName} (${placeInfo.placeId})`);
    console.log(`Registered mapping: ${result.place.displayName} [${result.place.slug}]`);
    if (setActive) {
      console.log('Active place updated.');
    }
    return;
  }

  const updated = {
    ...existing,
    gameId: placeInfo.gameId,
    detectedPlaceName: placeInfo.placeName,
    lastSeenAt: new Date().toISOString(),
  };
  registry.places[String(existing.placeId)] = updated;
  await saveRegistry(registry);

  if (setActive) {
    await setActiveSelection(updated);
  }

  const output = {
    detected: placeInfo,
    mapped: true,
    created: false,
    place: updated,
    activeSet: setActive,
  };
  if (parsed.booleans.has('json')) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(`Detected place: ${placeInfo.placeName} (${placeInfo.placeId})`);
  console.log(`Mapped to: ${updated.displayName} [${updated.slug}]`);
  if (setActive) {
    console.log('Active place updated.');
  }
}

async function cmdInit(parsed) {
  const requestedName = parsed.flags.get('name');
  const requestedSlug = parsed.flags.get('slug');
  const requestedTags = parseTagArg(parsed.flags.get('tags'));
  const setActive = !parsed.booleans.has('no-set-active');

  const placeInfo = await getCurrentPlaceInfo();
  const registry = await loadRegistry();
  const existing = findPlace(registry, String(placeInfo.placeId));

  let displayName = requestedName;
  let tags = requestedTags;

  if (!displayName && !existing) {
    const prompted = await promptNewPlaceDefaults(placeInfo);
    displayName = prompted.displayName;
    if (tags.length === 0) {
      tags = prompted.tags;
    }
  }

  const result = await registerCurrentPlace({
    displayName,
    slug: requestedSlug,
    tags,
  });

  if (setActive) {
    await setActiveSelection(result.place);
  }

  console.log(`${result.wasExisting ? 'Updated' : 'Created'} mapping: ${result.place.displayName} (${result.place.placeId}) [${result.place.slug}]`);
  if (setActive) {
    console.log('Active place updated.');
  }
}

async function cmdTag(parsed) {
  const action = parsed.positionals[1];
  const key = parsed.positionals[2];
  const tagsRaw = parsed.positionals[3];

  if (!action || !key || !tagsRaw || (action !== 'add' && action !== 'remove')) {
    throw new Error('Usage: node scripts/places.mjs tag <add|remove> <placeKey> <comma-separated-tags>');
  }

  const incomingTags = parseTagArg(tagsRaw);
  if (incomingTags.length === 0) {
    throw new Error('At least one tag is required.');
  }

  const registry = await loadRegistry();
  const place = findPlace(registry, key);
  if (!place) {
    throw new Error(`Place not found: ${key}`);
  }

  const current = new Set(normalizeTags(place.tags || []));
  if (action === 'add') {
    for (const tag of incomingTags) {
      current.add(tag);
    }
  } else {
    for (const tag of incomingTags) {
      current.delete(tag);
    }
  }

  const updated = {
    ...place,
    tags: [...current].sort(),
    lastSeenAt: new Date().toISOString(),
  };
  registry.places[String(place.placeId)] = updated;
  await saveRegistry(registry);

  console.log(`Updated tags for ${updated.displayName} (${updated.placeId}): ${updated.tags.join(',') || '-'}`);
}

async function cmdStatus(parsed) {
  const placeKey = parsed.flags.get('place');
  const context = await resolvePlaceContext({
    placeKey,
    autoDetect: true,
    useActive: true,
    allowLegacy: true,
  });
  const active = await loadActiveSelection();
  let detected = null;
  try {
    detected = await getCurrentPlaceInfo();
  } catch {
    detected = null;
  }

  const output = {
    mode: context.mode,
    detected,
    active,
    selectedPlace: context.place,
    paths: context.paths,
  };

  if (parsed.booleans.has('json')) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(`Mode: ${context.mode}`);
  if (detected) {
    console.log(`Detected Studio place: ${detected.placeName} (${detected.placeId})`);
  } else {
    console.log('Detected Studio place: unavailable');
  }
  if (active) {
    console.log(`Active selection: ${active.displayName} (${active.placeId}) [${active.slug}]`);
  } else {
    console.log('Active selection: none');
  }
  if (context.place) {
    console.log(`Resolved place: ${context.place.displayName} (${context.place.placeId}) [${context.place.slug}]`);
  } else {
    console.log('Resolved place: legacy blueprint-v1 root');
  }
  console.log(`Project: ${context.paths.project}`);
  console.log(`Properties: ${context.paths.propertiesFile}`);
  console.log(`Source root: ${context.paths.src}`);
}

async function main() {
  const parsed = parseFlags(process.argv.slice(2));
  if (parsed.booleans.has('help') || parsed.booleans.has('h')) {
    printHelp();
    return;
  }
  const command = parsed.positionals[0] || 'status';

  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command === 'detect') {
    await cmdDetect(parsed);
    return;
  }
  if (command === 'init') {
    await cmdInit(parsed);
    return;
  }
  if (command === 'list') {
    await cmdList(parsed);
    return;
  }
  if (command === 'use') {
    await cmdUse(parsed);
    return;
  }
  if (command === 'tag') {
    await cmdTag(parsed);
    return;
  }
  if (command === 'status') {
    await cmdStatus(parsed);
    return;
  }

  printHelp();
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
