#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const API_URL = 'https://api.openai.com/v1/audio/transcriptions';
const DEFAULT_OUT_DIR = 'transcripts';
const DEFAULT_MODEL = 'whisper-1';

function printHelp() {
  console.log(`Usage: npm run transcribe:whisper -- --file <audio.mp3> [options]

Required:
  --file <path>           Path to an input audio file (.mp3, .wav, .m4a, .webm)

Options:
  --out-dir <path>        Output directory (default: transcripts)
  --language <code>       Language hint, for example: en, ja
  --prompt <text>         Optional transcription prompt
  --model <name>          Transcription model (default: whisper-1)
  --segment-only          Only request segment timestamps
  --overwrite             Overwrite existing output files
  --help                  Show this message

Environment:
  OPENAI_API_KEY          Required. Kept out of the repo and used at runtime only.

Outputs:
  <name>.whisper.verbose.json   Raw API response
  <name>.dialogue.json          Simplified dialogue + word timing data
  <name>.dialogue.txt           Human-readable segment timings
`);
}

function parseArgs(argv) {
  const args = {
    file: '',
    outDir: DEFAULT_OUT_DIR,
    language: undefined,
    prompt: undefined,
    model: DEFAULT_MODEL,
    segmentOnly: false,
    overwrite: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--file' && argv[i + 1]) {
      args.file = argv[++i];
    } else if (token === '--out-dir' && argv[i + 1]) {
      args.outDir = argv[++i];
    } else if (token === '--language' && argv[i + 1]) {
      args.language = argv[++i];
    } else if (token === '--prompt' && argv[i + 1]) {
      args.prompt = argv[++i];
    } else if (token === '--model' && argv[i + 1]) {
      args.model = argv[++i];
    } else if (token === '--segment-only') {
      args.segmentOnly = true;
    } else if (token === '--overwrite') {
      args.overwrite = true;
    } else if (token === '--help' || token === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }

  if (!args.help && !args.file) {
    throw new Error('Missing required argument: --file');
  }

  return args;
}

function inferMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.mp3':
      return 'audio/mpeg';
    case '.wav':
      return 'audio/wav';
    case '.m4a':
      return 'audio/mp4';
    case '.mp4':
      return 'audio/mp4';
    case '.webm':
      return 'audio/webm';
    case '.ogg':
      return 'audio/ogg';
    case '.flac':
      return 'audio/flac';
    default:
      return 'application/octet-stream';
  }
}

function roundSeconds(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  return Math.round(value * 1000) / 1000;
}

function normalizeText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toTimestamp(seconds) {
  if (typeof seconds !== 'number' || Number.isNaN(seconds)) {
    return '?.???';
  }
  return seconds.toFixed(3).padStart(7, '0');
}

async function ensureOutputPaths(outDir, baseName, overwrite) {
  await fs.mkdir(outDir, { recursive: true });
  const verbosePath = path.join(outDir, `${baseName}.whisper.verbose.json`);
  const dialoguePath = path.join(outDir, `${baseName}.dialogue.json`);
  const textPath = path.join(outDir, `${baseName}.dialogue.txt`);

  if (!overwrite) {
    for (const filePath of [verbosePath, dialoguePath, textPath]) {
      try {
        await fs.access(filePath);
        throw new Error(`Refusing to overwrite existing file: ${filePath}. Pass --overwrite if that is intended.`);
      } catch (error) {
        if (error?.code !== 'ENOENT') {
          throw error;
        }
      }
    }
  }

  return { verbosePath, dialoguePath, textPath };
}

async function transcribeAudio(args, inputPath) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set in this shell.');
  }

  const bytes = await fs.readFile(inputPath);
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: inferMimeType(inputPath) }), path.basename(inputPath));
  form.append('model', args.model);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');
  if (!args.segmentOnly) {
    form.append('timestamp_granularities[]', 'word');
  }
  if (args.language) {
    form.append('language', args.language);
  }
  if (args.prompt) {
    form.append('prompt', args.prompt);
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  const rawText = await response.text();
  let payload;
  try {
    payload = JSON.parse(rawText);
  } catch {
    payload = { raw: rawText };
  }

  if (!response.ok) {
    const message = payload?.error?.message || rawText || `HTTP ${response.status}`;
    throw new Error(`Transcription failed: ${message}`);
  }

  return payload;
}

function buildDialoguePayload(raw, inputPath, model) {
  const segments = Array.isArray(raw?.segments) ? raw.segments : [];
  const words = Array.isArray(raw?.words) ? raw.words : [];
  const normalizedSegments = segments.map((segment, index) => ({
    index,
    startSec: roundSeconds(segment?.start),
    endSec: roundSeconds(segment?.end),
    durationSec: roundSeconds((segment?.end ?? 0) - (segment?.start ?? 0)),
    text: normalizeText(segment?.text),
  }));
  const normalizedWords = words.map((word, index) => ({
    index,
    text: normalizeText(word?.word),
    startSec: roundSeconds(word?.start),
    endSec: roundSeconds(word?.end),
    durationSec: roundSeconds((word?.end ?? 0) - (word?.start ?? 0)),
  }));
  const durationSec = roundSeconds(
    typeof raw?.duration === 'number'
      ? raw.duration
      : Math.max(
          0,
          ...normalizedSegments.map((segment) => segment.endSec ?? 0),
          ...normalizedWords.map((word) => word.endSec ?? 0),
        ),
  );

  return {
    sourceFile: inputPath,
    model,
    generatedAt: new Date().toISOString(),
    language: raw?.language ?? null,
    durationSec,
    text: normalizeText(raw?.text),
    segments: normalizedSegments,
    words: normalizedWords,
  };
}

function buildSegmentText(dialogue) {
  const lines = [
    `source: ${dialogue.sourceFile}`,
    `model: ${dialogue.model}`,
    `language: ${dialogue.language ?? 'unknown'}`,
    `durationSec: ${dialogue.durationSec ?? 'unknown'}`,
    '',
  ];

  for (const segment of dialogue.segments) {
    lines.push(`[${toTimestamp(segment.startSec)} - ${toTimestamp(segment.endSec)}] ${segment.text}`);
  }

  if (dialogue.segments.length === 0 && dialogue.text) {
    lines.push(dialogue.text);
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const inputPath = path.resolve(process.cwd(), args.file);
  const inputStat = await fs.stat(inputPath);
  if (!inputStat.isFile()) {
    throw new Error(`Input is not a file: ${inputPath}`);
  }

  const outDir = path.resolve(process.cwd(), args.outDir);
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const output = await ensureOutputPaths(outDir, baseName, args.overwrite);
  const raw = await transcribeAudio(args, inputPath);
  const dialogue = buildDialoguePayload(raw, inputPath, args.model);

  await Promise.all([
    fs.writeFile(output.verbosePath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8'),
    fs.writeFile(output.dialoguePath, `${JSON.stringify(dialogue, null, 2)}\n`, 'utf8'),
    fs.writeFile(output.textPath, buildSegmentText(dialogue), 'utf8'),
  ]);

  console.log(JSON.stringify({
    ok: true,
    input: inputPath,
    outputDir: outDir,
    verboseJson: output.verbosePath,
    dialogueJson: output.dialoguePath,
    dialogueText: output.textPath,
    segments: dialogue.segments.length,
    words: dialogue.words.length,
    durationSec: dialogue.durationSec,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
