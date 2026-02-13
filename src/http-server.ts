import express from 'express';
import cors from 'cors';
import { RobloxStudioTools } from './tools/index.js';
import { BridgeService } from './bridge-service.js';

export function createHttpServer(tools: RobloxStudioTools, bridge: BridgeService) {
  const app = express();
  let pluginConnected = false;
  let mcpServerActive = false;
  let lastMCPActivity = 0;
  let mcpServerStartTime = 0;
  let lastPluginActivity = 0;
  let pluginVersion: string | null = null;
  let pluginInstanceId: string | null = null;
  let pluginCapabilities: Record<string, boolean> = {};
  let pluginLastReportedAt = 0;
  const metricsHistory: Array<{ timestamp: number; bridge: ReturnType<BridgeService['getStats']> }> = [];
  const recentErrors: Array<{ timestamp: number; endpoint: string; message: string }> = [];
  const idempotencyCache = new Map<string, { statusCode: number; body: any; createdAt: number; expiresAt: number; endpoint: string }>();
  const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;

  const serverCapabilities = {
    setScriptSourceFast: true,
    batchScriptEdits: true,
    writeQueue: true,
    runtimeMetrics: true,
    fullSourceReads: true,
    applyAndVerify: true,
    scriptSnapshots: true,
    driftCheck: true,
    idempotentWrites: true
  };

  const writeEndpoints = new Set([
    'set_script_source',
    'set_script_source_checked',
    'set_script_source_fast',
    'set_script_source_fast_gzip',
    'apply_and_verify_script_source',
    'rollback_script_snapshot',
    'batch_script_edits',
    'edit_script_lines',
    'insert_script_lines',
    'delete_script_lines',
    'set_property',
    'mass_set_property',
    'create_object',
    'create_object_with_properties',
    'mass_create_objects',
    'mass_create_objects_with_properties',
    'delete_object',
    'set_attribute',
    'delete_attribute',
    'add_tag',
    'remove_tag',
    'set_calculated_property',
    'set_relative_property',
    'smart_duplicate',
    'mass_duplicate',
  ]);

  const readHeaderString = (value: string | string[] | undefined): string | null => {
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value) && typeof value[0] === 'string') {
      return value[0];
    }
    return null;
  };

  const parseCapabilitiesHeader = (raw: string | null): Record<string, boolean> | null => {
    if (!raw || raw.length === 0) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }
      const capabilities: Record<string, boolean> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'boolean') {
          capabilities[key] = value;
        }
      }
      return capabilities;
    } catch {
      return null;
    }
  };

  const recordError = (endpoint: string, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    recentErrors.push({
      timestamp: Date.now(),
      endpoint,
      message,
    });
    if (recentErrors.length > 200) {
      recentErrors.shift();
    }
  };

  const sweepIdempotencyCache = () => {
    const now = Date.now();
    for (const [key, entry] of idempotencyCache.entries()) {
      if (now >= entry.expiresAt) {
        idempotencyCache.delete(key);
      }
    }
  };

  const getIdempotencyKey = (req: express.Request): string | null => {
    const header = readHeaderString(req.headers['x-idempotency-key']);
    const bodyKey = typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey : null;
    const key = (header || bodyKey || '').trim();
    return key.length > 0 ? key : null;
  };

  const getWriteReadiness = () => {
    if (!pluginConnected) {
      return { ready: false, reason: 'Plugin is not connected.' };
    }
    if (!isMCPServerActive()) {
      return { ready: false, reason: 'MCP server is not active.' };
    }
    if (Date.now() - lastPluginActivity > 15000) {
      return { ready: false, reason: 'Plugin heartbeat is stale.' };
    }
    return { ready: true, reason: 'ready' };
  };

  // Track MCP server lifecycle
  const setMCPServerActive = (active: boolean) => {
    mcpServerActive = active;
    if (active) {
      mcpServerStartTime = Date.now();
      lastMCPActivity = Date.now();
    } else {
      mcpServerStartTime = 0;
      lastMCPActivity = 0;
    }
  };

  const trackMCPActivity = () => {
    if (mcpServerActive) {
      lastMCPActivity = Date.now();
    }
  };

  const isMCPServerActive = () => {
    if (!mcpServerActive) return false;
    const now = Date.now();
    const mcpRecent = (now - lastMCPActivity) < 15000;
    const pluginPollingRecent = (now - lastPluginActivity) < 15000;
    // Consider bridge connected if MCP had recent activity OR plugin is polling (reconnect after Studio restart)
    return mcpRecent || pluginPollingRecent;
  };

  const isPluginConnected = () => {
    // Consider plugin disconnected if no activity for 10 seconds
    return pluginConnected && (Date.now() - lastPluginActivity < 10000);
  };

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      service: 'robloxstudio-mcp',
      pluginConnected,
      mcpServerActive: isMCPServerActive(),
      uptime: mcpServerActive ? Date.now() - mcpServerStartTime : 0,
      bridge: bridge.getStats(),
      plugin: {
        version: pluginVersion,
        instanceId: pluginInstanceId,
        capabilities: pluginCapabilities,
        lastReportedAt: pluginLastReportedAt
      },
      serverCapabilities
    });
  });

  // Plugin readiness endpoint
  app.post('/ready', (req, res) => {
    pluginConnected = true;
    lastPluginActivity = Date.now();
    if (typeof req.body?.version === 'string') {
      pluginVersion = req.body.version;
    }
    if (typeof req.body?.pluginInstanceId === 'string') {
      pluginInstanceId = req.body.pluginInstanceId;
    }
    if (req.body?.capabilities && typeof req.body.capabilities === 'object') {
      pluginCapabilities = req.body.capabilities;
    }
    pluginLastReportedAt = Date.now();
    res.json({ success: true });
  });

  // Plugin disconnect endpoint
  app.post('/disconnect', (req, res) => {
    pluginConnected = false;
    // Clear any pending requests when plugin disconnects
    bridge.clearAllPendingRequests();
    res.json({ success: true });
  });

  // Enhanced status endpoint
  app.get('/status', (req, res) => {
    res.json({ 
      pluginConnected,
      mcpServerActive: isMCPServerActive(),
      lastMCPActivity,
      uptime: mcpServerActive ? Date.now() - mcpServerStartTime : 0,
      bridge: bridge.getStats(),
      plugin: {
        version: pluginVersion,
        instanceId: pluginInstanceId,
        capabilities: pluginCapabilities,
        lastReportedAt: pluginLastReportedAt
      },
      serverCapabilities
    });
  });

  app.get('/metrics', (req, res) => {
    const bridgeStats = bridge.getStats();
    metricsHistory.push({ timestamp: Date.now(), bridge: bridgeStats });
    if (metricsHistory.length > 720) {
      metricsHistory.shift();
    }
    res.json({
      status: 'ok',
      generatedAt: Date.now(),
      bridge: bridgeStats,
      plugin: {
        connected: pluginConnected,
        version: pluginVersion,
        instanceId: pluginInstanceId,
        capabilities: pluginCapabilities,
        lastReportedAt: pluginLastReportedAt
      },
      serverCapabilities
    });
  });

  app.get('/diagnostics', (req, res) => {
    sweepIdempotencyCache();
    res.json({
      status: 'ok',
      generatedAt: Date.now(),
      readiness: getWriteReadiness(),
      plugin: {
        connected: pluginConnected,
        version: pluginVersion,
        instanceId: pluginInstanceId,
        capabilities: pluginCapabilities,
        lastReportedAt: pluginLastReportedAt,
      },
      idempotency: {
        entries: idempotencyCache.size,
        ttlMs: IDEMPOTENCY_TTL_MS,
      },
      recentErrors,
      bridge: bridge.getStats(),
      writeQueue: tools.getWriteQueueStats(),
    });
  });

  app.get('/metrics/history', (req, res) => {
    res.json({
      status: 'ok',
      points: metricsHistory.length,
      history: metricsHistory
    });
  });

  // Enhanced polling endpoint for Studio plugin
  app.get('/poll', (req, res) => {
    // Always track that plugin is polling (shows it's trying to connect)
    if (!pluginConnected) {
      pluginConnected = true;
    }
    const queryVersion = typeof req.query?.v === 'string' ? req.query.v : null;
    const queryCapabilitiesRaw = typeof req.query?.caps === 'string' ? req.query.caps : null;
    let manualVersion: string | null = null;
    let manualCapabilitiesRaw: string | null = null;
    try {
      const rawUrl = req.originalUrl || req.url || '';
      const queryStart = rawUrl.indexOf('?');
      if (queryStart >= 0 && queryStart < rawUrl.length - 1) {
        const params = new URLSearchParams(rawUrl.slice(queryStart + 1));
        manualVersion = params.get('v');
        manualCapabilitiesRaw = params.get('caps');
      }
    } catch {
      // Ignore malformed query and continue with express parsed query/header sources.
    }
    const headerVersion = readHeaderString(req.headers['x-mcp-plugin-version']);
    const candidateVersion = queryVersion || manualVersion || headerVersion;
    if (candidateVersion) {
      pluginVersion = candidateVersion;
      pluginLastReportedAt = Date.now();
    }
    const queryInstanceId = typeof req.query?.sid === 'string' ? req.query.sid : null;
    if (queryInstanceId) {
      pluginInstanceId = queryInstanceId;
      pluginLastReportedAt = Date.now();
    }
    const headerCapabilitiesRaw = readHeaderString(req.headers['x-mcp-plugin-capabilities']);
    const candidateCapabilities = parseCapabilitiesHeader(queryCapabilitiesRaw || manualCapabilitiesRaw || headerCapabilitiesRaw);
    if (candidateCapabilities && Object.keys(candidateCapabilities).length > 0) {
      pluginCapabilities = candidateCapabilities;
      pluginLastReportedAt = Date.now();
    }
    lastPluginActivity = Date.now();
    // Refresh MCP activity on every poll so that after Studio reconnects (e.g. was closed),
    // the first poll makes isMCPServerActive() true again and the bridge reconnects.
    trackMCPActivity();
    
    if (!isMCPServerActive()) {
      res.status(503).json({ 
        error: 'MCP server not connected',
        pluginConnected: true,
        mcpConnected: false,
        request: null,
        plugin: {
          version: pluginVersion,
          instanceId: pluginInstanceId,
          capabilities: pluginCapabilities,
          lastReportedAt: pluginLastReportedAt,
        },
        serverCapabilities
      });
      return;
    }
    
    trackMCPActivity();
    
    const pendingRequest = bridge.getPendingRequest();
    if (pendingRequest) {
      res.json({ 
        request: pendingRequest.request, 
        requestId: pendingRequest.requestId,
        mcpConnected: true,
        pluginConnected: true,
        plugin: {
          version: pluginVersion,
          instanceId: pluginInstanceId,
          capabilities: pluginCapabilities,
          lastReportedAt: pluginLastReportedAt,
        },
        serverCapabilities
      });
    } else {
      res.json({ 
        request: null,
        mcpConnected: true,
        pluginConnected: true,
        plugin: {
          version: pluginVersion,
          instanceId: pluginInstanceId,
          capabilities: pluginCapabilities,
          lastReportedAt: pluginLastReportedAt,
        },
        serverCapabilities
      });
    }
  });

  // Response endpoint for Studio plugin
  app.post('/response', (req, res) => {
    const { requestId, response, error } = req.body;
    
    if (error) {
      recordError('/response', error);
      bridge.rejectRequest(requestId, error);
    } else {
      bridge.resolveRequest(requestId, response);
    }
    
    res.json({ success: true });
  });

  // Middleware to track MCP activity for all MCP endpoints
  app.use('/mcp/*', (req, res, next) => {
    trackMCPActivity();
    sweepIdempotencyCache();
    const fromBase = `${req.baseUrl || ''}${req.path || ''}`.split('?')[0] || '';
    const originalPath = (req.originalUrl || req.url || '').split('?')[0] || '';
    const selectedPath = fromBase.startsWith('/mcp/') ? fromBase : originalPath;
    const endpoint = selectedPath
      .replace(/^\/mcp\//, '')
      .replace(/\/+$/, '')
      .replace(/^\//, '');
    if (writeEndpoints.has(endpoint)) {
      const readiness = getWriteReadiness();
      if (!readiness.ready) {
        recordError(`/mcp/${endpoint}`, readiness.reason);
        res.status(503).json({ error: readiness.reason, endpoint, readiness });
        return;
      }
    }
    const key = getIdempotencyKey(req);
    if (req.method === 'POST' && key && writeEndpoints.has(endpoint)) {
      const composite = `${endpoint}:${key}`;
      const cached = idempotencyCache.get(composite);
      if (cached && Date.now() < cached.expiresAt) {
        res.status(cached.statusCode).json({
          ...cached.body,
          idempotency: {
            replayed: true,
            key,
            createdAt: cached.createdAt,
          }
        });
        return;
      }
      const originalJson = res.json.bind(res);
      (res as any).json = (body: any) => {
        if (res.statusCode < 500) {
          idempotencyCache.set(composite, {
            statusCode: res.statusCode,
            body,
            createdAt: Date.now(),
            expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
            endpoint,
          });
        }
        return originalJson(body);
      };
    }
    next();
  });

  // MCP tool proxy endpoints - these will be called by AI tools
  app.post('/mcp/get_file_tree', async (req, res) => {
    try {
      const result = await tools.getFileTree(req.body.path);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });


  app.post('/mcp/search_files', async (req, res) => {
    try {
      const result = await tools.searchFiles(req.body.query, req.body.searchType);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });


  app.post('/mcp/get_place_info', async (req, res) => {
    try {
      const result = await tools.getPlaceInfo();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/get_services', async (req, res) => {
    try {
      const result = await tools.getServices(req.body.serviceName);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });


  app.post('/mcp/search_objects', async (req, res) => {
    try {
      const result = await tools.searchObjects(req.body.query, req.body.searchType, req.body.propertyName);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/get_instance_properties', async (req, res) => {
    try {
      const result = await tools.getInstanceProperties(req.body.instancePath);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/get_instance_children', async (req, res) => {
    try {
      const result = await tools.getInstanceChildren(req.body.instancePath);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/search_by_property', async (req, res) => {
    try {
      const result = await tools.searchByProperty(req.body.propertyName, req.body.propertyValue);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/get_class_info', async (req, res) => {
    try {
      const result = await tools.getClassInfo(req.body.className);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/mass_set_property', async (req, res) => {
    try {
      const result = await tools.massSetProperty(req.body.paths, req.body.propertyName, req.body.propertyValue);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/mass_get_property', async (req, res) => {
    try {
      const result = await tools.massGetProperty(req.body.paths, req.body.propertyName);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/create_object_with_properties', async (req, res) => {
    try {
      const result = await tools.createObjectWithProperties(req.body.className, req.body.parent, req.body.name, req.body.properties);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/mass_create_objects', async (req, res) => {
    try {
      const result = await tools.massCreateObjects(req.body.objects);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/mass_create_objects_with_properties', async (req, res) => {
    try {
      const result = await tools.massCreateObjectsWithProperties(req.body.objects);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/get_project_structure', async (req, res) => {
    try {
      const result = await tools.getProjectStructure(req.body.path, req.body.maxDepth, req.body.scriptsOnly);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Script management endpoints (parity with tools)
  app.post('/mcp/get_script_source', async (req, res) => {
    try {
      const result = await tools.getScriptSource(req.body.instancePath, req.body.startLine, req.body.endLine);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/get_script_snapshot', async (req, res) => {
    try {
      const result = await tools.getScriptSnapshot(req.body.instancePath, req.body.startLine, req.body.endLine);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/set_script_source', async (req, res) => {
    try {
      const result = await tools.setScriptSource(req.body.instancePath, req.body.source, req.body.expectedHash);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/set_script_source_checked', async (req, res) => {
    try {
      const result = await tools.setScriptSourceChecked(req.body.instancePath, req.body.source, req.body.expectedHash);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/set_script_source_fast', async (req, res) => {
    try {
      const result = await tools.setScriptSourceFast(req.body.instancePath, req.body.source, req.body.verify);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/set_script_source_fast_gzip', async (req, res) => {
    try {
      const result = await tools.setScriptSourceFastGzip(req.body.instancePath, req.body.sourceGzipBase64, req.body.verify);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/batch_script_edits', async (req, res) => {
    try {
      const result = await tools.batchScriptEdits(
        req.body.instancePath,
        req.body.operations,
        req.body.expectedHash,
        req.body.rollbackOnFailure,
        req.body.fastMode
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/get_selection', async (req, res) => {
    try {
      const result = await tools.getSelection();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/execute_luau', async (req, res) => {
    try {
      const result = await tools.executeLuau(req.body.code);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/get_runtime_state', async (req, res) => {
    try {
      res.json({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              pluginConnected,
              mcpServerActive: isMCPServerActive(),
              pluginVersion,
              pluginCapabilities,
              pluginLastReportedAt,
              serverCapabilities,
              writeQueue: tools.getWriteQueueStats(),
              bridge: bridge.getStats()
            }, null, 2)
          }
        ]
      });
    } catch (error) {
      recordError('/mcp/get_runtime_state', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/get_diagnostics', async (req, res) => {
    try {
      sweepIdempotencyCache();
      res.json({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              readiness: getWriteReadiness(),
              plugin: {
                connected: pluginConnected,
                version: pluginVersion,
                instanceId: pluginInstanceId,
                capabilities: pluginCapabilities,
                lastReportedAt: pluginLastReportedAt,
              },
              idempotency: {
                entries: idempotencyCache.size,
                ttlMs: IDEMPOTENCY_TTL_MS,
              },
              recentErrors,
              bridge: bridge.getStats(),
              writeQueue: tools.getWriteQueueStats(),
            }, null, 2)
          }
        ]
      });
    } catch (error) {
      recordError('/mcp/get_diagnostics', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/check_script_drift', async (req, res) => {
    try {
      const result = await tools.checkScriptDrift(req.body.mappings, req.body.normalizeLineEndings);
      res.json(result);
    } catch (error) {
      recordError('/mcp/check_script_drift', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/lint_deprecated_apis', async (req, res) => {
    try {
      const result = await tools.lintDeprecatedApis(req.body.rootPath);
      res.json(result);
    } catch (error) {
      recordError('/mcp/lint_deprecated_apis', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/create_script_snapshot', async (req, res) => {
    try {
      const result = await tools.createScriptSnapshot(req.body.instancePath, req.body.label);
      res.json(result);
    } catch (error) {
      recordError('/mcp/create_script_snapshot', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/list_script_snapshots', async (req, res) => {
    try {
      const result = await tools.listScriptSnapshots(req.body.instancePath);
      res.json(result);
    } catch (error) {
      recordError('/mcp/list_script_snapshots', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/rollback_script_snapshot', async (req, res) => {
    try {
      const result = await tools.rollbackScriptSnapshot(req.body.snapshotId, req.body.verify);
      res.json(result);
    } catch (error) {
      recordError('/mcp/rollback_script_snapshot', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/apply_and_verify_script_source', async (req, res) => {
    try {
      const result = await tools.applyAndVerifyScriptSource(
        req.body.instancePath,
        req.body.source,
        req.body.expectedHash,
        req.body.verifyNeedle,
        req.body.rollbackOnFailure,
        req.body.preferFast,
      );
      res.json(result);
    } catch (error) {
      recordError('/mcp/apply_and_verify_script_source', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/cancel_pending_writes', async (req, res) => {
    try {
      const result = tools.cancelPendingWrites(req.body?.prefix);
      res.json({
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      });
    } catch (error) {
      recordError('/mcp/cancel_pending_writes', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Property modification endpoint
  app.post('/mcp/set_property', async (req, res) => {
    try {
      const result = await tools.setProperty(req.body.instancePath, req.body.propertyName, req.body.propertyValue);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Object creation/deletion endpoints
  app.post('/mcp/create_object', async (req, res) => {
    try {
      const result = await tools.createObject(req.body.className, req.body.parent, req.body.name);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/delete_object', async (req, res) => {
    try {
      const result = await tools.deleteObject(req.body.instancePath);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Smart duplication endpoints
  app.post('/mcp/smart_duplicate', async (req, res) => {
    try {
      const result = await tools.smartDuplicate(req.body.instancePath, req.body.count, req.body.options);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/mass_duplicate', async (req, res) => {
    try {
      const result = await tools.massDuplicate(req.body.duplications);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Calculated/relative property endpoints
  app.post('/mcp/set_calculated_property', async (req, res) => {
    try {
      const result = await tools.setCalculatedProperty(req.body.paths, req.body.propertyName, req.body.formula, req.body.variables);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/set_relative_property', async (req, res) => {
    try {
      const result = await tools.setRelativeProperty(req.body.paths, req.body.propertyName, req.body.operation, req.body.value, req.body.component);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Partial script editing endpoints
  app.post('/mcp/edit_script_lines', async (req, res) => {
    try {
      const result = await tools.editScriptLines(req.body.instancePath, req.body.startLine, req.body.endLine, req.body.newContent);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/insert_script_lines', async (req, res) => {
    try {
      const result = await tools.insertScriptLines(req.body.instancePath, req.body.afterLine, req.body.newContent);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/delete_script_lines', async (req, res) => {
    try {
      const result = await tools.deleteScriptLines(req.body.instancePath, req.body.startLine, req.body.endLine);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Attribute endpoints
  app.post('/mcp/get_attribute', async (req, res) => {
    try {
      const result = await tools.getAttribute(req.body.instancePath, req.body.attributeName);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/set_attribute', async (req, res) => {
    try {
      const result = await tools.setAttribute(req.body.instancePath, req.body.attributeName, req.body.attributeValue, req.body.valueType);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/get_attributes', async (req, res) => {
    try {
      const result = await tools.getAttributes(req.body.instancePath);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/delete_attribute', async (req, res) => {
    try {
      const result = await tools.deleteAttribute(req.body.instancePath, req.body.attributeName);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Tag (CollectionService) endpoints
  app.post('/mcp/get_tags', async (req, res) => {
    try {
      const result = await tools.getTags(req.body.instancePath);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/add_tag', async (req, res) => {
    try {
      const result = await tools.addTag(req.body.instancePath, req.body.tagName);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/remove_tag', async (req, res) => {
    try {
      const result = await tools.removeTag(req.body.instancePath, req.body.tagName);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/get_tagged', async (req, res) => {
    try {
      const result = await tools.getTagged(req.body.tagName);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/start_playtest', async (req, res) => {
    try {
      const result = await tools.startPlaytest(req.body.mode);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/stop_playtest', async (req, res) => {
    try {
      const result = await tools.stopPlaytest();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post('/mcp/get_playtest_output', async (req, res) => {
    try {
      const result = await tools.getPlaytestOutput();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Add methods to control and check server status
  (app as any).isPluginConnected = isPluginConnected;
  (app as any).setMCPServerActive = setMCPServerActive;
  (app as any).isMCPServerActive = isMCPServerActive;
  (app as any).trackMCPActivity = trackMCPActivity;

  return app;
}
