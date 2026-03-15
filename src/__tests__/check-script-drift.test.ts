import { mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { BridgeService } from '../bridge-service.js';
import { RobloxStudioTools } from '../tools/index.js';

describe('checkScriptDrift', () => {
  let tempDir: string;
  let tools: RobloxStudioTools;
  let studioRequest: jest.Mock;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'roblox-mcp-drift-'));
    tools = new RobloxStudioTools(new BridgeService());
    studioRequest = jest.fn();
    (tools as any).client = {
      request: studioRequest,
    };
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  async function runDriftCheck(localSource: string, studioSource: string, normalizeLineEndings: boolean = true) {
    const localFile = path.join(tempDir, 'Main.server.luau');
    await writeFile(localFile, localSource, 'utf8');
    studioRequest.mockResolvedValue({ source: studioSource });

    const response = await tools.checkScriptDrift(
      [{ instancePath: 'game.ServerScriptService.Main', localFile }],
      normalizeLineEndings,
    );

    return JSON.parse(response.content[0].text);
  }

  test('treats CRLF and trailing newline differences as formatting-only by default', async () => {
    const result = await runDriftCheck(
      'print("hi")\r\nreturn 1\r\n',
      'print("hi")\nreturn 1',
    );

    expect(result.summary).toMatchObject({
      total: 1,
      inSync: 1,
      formattingOnly: 1,
      drift: 0,
      failures: 0,
    });
    expect(result.results[0]).toMatchObject({
      status: 'in-sync',
      comparisonMode: 'canonical-text',
      formattingOnly: true,
      localLineCount: 2,
      studioLineCount: 2,
    });
    expect(result.results[0].formattingDifferences).toEqual(
      expect.arrayContaining(['line-endings', 'trailing-newline']),
    );
    expect(result.results[0].rawLocalHash).not.toBe(result.results[0].rawStudioHash);
    expect(result.results[0].normalizedLocalHash).toBe(result.results[0].normalizedStudioHash);
  });

  test('treats BOM and trailing whitespace differences as formatting-only by default', async () => {
    const result = await runDriftCheck(
      '\ufeffprint("hi")  \nreturn 1\t\n',
      'print("hi")\nreturn 1',
    );

    expect(result.summary.formattingOnly).toBe(1);
    expect(result.results[0].status).toBe('in-sync');
    expect(result.results[0].formattingDifferences).toEqual(
      expect.arrayContaining(['bom', 'trailing-whitespace', 'trailing-newline']),
    );
  });

  test('still reports real content drift after canonical normalization', async () => {
    const result = await runDriftCheck(
      'print("hi")\r\nreturn 1\r\n',
      'print("bye")\nreturn 1',
    );

    expect(result.summary).toMatchObject({
      inSync: 0,
      formattingOnly: 0,
      drift: 1,
    });
    expect(result.results[0].status).toBe('drift');
    expect(result.results[0].formattingOnly).toBe(false);
  });

  test('can still compare raw bytes when normalization is disabled', async () => {
    const result = await runDriftCheck(
      'print("hi")\r\nreturn 1\r\n',
      'print("hi")\nreturn 1',
      false,
    );

    expect(result.summary).toMatchObject({
      inSync: 0,
      formattingOnly: 0,
      drift: 1,
    });
    expect(result.results[0]).toMatchObject({
      status: 'drift',
      comparisonMode: 'raw',
      formattingOnly: false,
    });
  });

  test('reconstructs full Studio source when the plugin truncates a full-source read', async () => {
    const lines = Array.from({ length: 1205 }, (_, index) => `line_${index + 1}`);
    const studioSource = lines.join('\n');
    const truncatedSource = lines.slice(0, 1000).join('\n');
    const localFile = path.join(tempDir, 'Chunked.server.luau');

    await writeFile(localFile, studioSource, 'utf8');
    studioRequest.mockImplementation(async (_endpoint: string, payload: Record<string, unknown>) => {
      if (payload.fullSource === true) {
        return {
          source: truncatedSource,
          sourceLength: studioSource.length,
          lineCount: lines.length,
          startLine: 1,
          endLine: 1000,
          truncated: true,
        };
      }

      if (payload.startLine === 1 && payload.endLine === 1000) {
        return {
          source: truncatedSource,
          sourceLength: studioSource.length,
          lineCount: lines.length,
          startLine: 1,
          endLine: 1000,
          truncated: false,
        };
      }

      if (payload.startLine === 1001 && payload.endLine === 1205) {
        return {
          source: lines.slice(1000).join('\n'),
          sourceLength: studioSource.length,
          lineCount: lines.length,
          startLine: 1001,
          endLine: 1205,
          truncated: false,
        };
      }

      throw new Error(`Unexpected payload: ${JSON.stringify(payload)}`);
    });

    const response = await tools.getScriptSnapshot('game.ServerScriptService.Chunked');
    const snapshot = JSON.parse(response.content[0].text);

    expect(snapshot.source).toBe(studioSource);
    expect(snapshot.truncated).toBe(false);
    expect(snapshot.reconstructedFromChunks).toBe(true);

    const driftResponse = await tools.checkScriptDrift(
      [{ instancePath: 'game.ServerScriptService.Chunked', localFile }],
      true,
    );
    const drift = JSON.parse(driftResponse.content[0].text);

    expect(drift.summary).toMatchObject({
      inSync: 1,
      drift: 0,
      failures: 0,
    });
  });
});
