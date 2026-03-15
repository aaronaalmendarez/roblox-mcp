import { BridgeService } from '../bridge-service.js';
import { RobloxStudioTools } from '../tools/index.js';

describe('script write safety', () => {
  let tools: RobloxStudioTools;
  let studioRequest: jest.Mock;

  beforeEach(() => {
    tools = new RobloxStudioTools(new BridgeService());
    studioRequest = jest.fn();
    (tools as any).client = {
      request: studioRequest,
    };
  });

  test('rejects set_property on Source', async () => {
    await expect(
      tools.setProperty('game.ServerScriptService.Main', 'Source', 'print("bad")'),
    ).rejects.toThrow('set_property cannot be used for the Source property');
  });

  test('commits chunked uploads through set-script-source bridge', async () => {
    studioRequest.mockResolvedValue({
      success: true,
      method: 'UpdateSourceAsync',
    });

    const begin = JSON.parse((await tools.beginScriptSourceUpload('game.ServerScriptService.Main')).content[0].text);
    await tools.appendScriptSourceUploadChunk(begin.uploadId, 'print("hello")\n', 0);
    await tools.appendScriptSourceUploadChunk(begin.uploadId, 'return 1', 1);
    await tools.commitScriptSourceUpload(begin.uploadId);

    expect(studioRequest).toHaveBeenCalledWith('/api/set-script-source', {
      instancePath: 'game.ServerScriptService.Main',
      source: 'print("hello")\nreturn 1',
      preferDirect: false,
    });
  });

  test('fast write fallback uses set-script-source bridge instead of set-property', async () => {
    studioRequest.mockImplementation(async (endpoint: string) => {
      if (endpoint === '/api/set-script-source-fast') {
        throw new Error('Unknown endpoint: /api/set-script-source-fast');
      }
      if (endpoint === '/api/set-script-source') {
        return {
          success: true,
          method: 'UpdateSourceAsync',
        };
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`);
    });

    const response = await tools.setScriptSourceFast('game.ServerScriptService.Main', 'print("safe")', false);
    const payload = JSON.parse(response.content[0].text);

    expect(payload.method).toBe('fast-fallback-bridge');
    expect(studioRequest).not.toHaveBeenCalledWith(
      '/api/set-property',
      expect.anything(),
    );
  });
});
