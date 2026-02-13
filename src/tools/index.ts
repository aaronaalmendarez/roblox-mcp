import { StudioHttpClient } from './studio-client.js';
import { BridgeService } from '../bridge-service.js';
import { createHash } from 'crypto';
import { gunzipSync } from 'zlib';
import { readFile, readdir } from 'fs/promises';
import path from 'path';

type ScriptEditReplaceOperation = {
  op: 'replace';
  startLine: number;
  endLine: number;
  newContent: string;
};

type ScriptEditInsertOperation = {
  op: 'insert';
  afterLine: number;
  newContent: string;
};

type ScriptEditDeleteOperation = {
  op: 'delete';
  startLine: number;
  endLine: number;
};

type ScriptEditOperation = ScriptEditReplaceOperation | ScriptEditInsertOperation | ScriptEditDeleteOperation;
type ScriptSnapshotRecord = {
  id: string;
  instancePath: string;
  label: string;
  source: string;
  sourceHash: string;
  createdAt: number;
  sourceLength: number;
};
type WriteQueueItem<T> = {
  id: string;
  priority: number;
  label: string;
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  createdAt: number;
  cancelled: boolean;
};

export class RobloxStudioTools {
  private client: StudioHttpClient;
  private static readonly DIRECT_WRITE_THRESHOLD = 100_000;
  private fastEndpointSupport: 'unknown' | 'yes' | 'no' = 'unknown';
  private writeQueue: WriteQueueItem<any>[] = [];
  private writeInFlight: WriteQueueItem<any> | null = null;
  private writeQueueSeq = 0;
  private completedWrites = 0;
  private failedWrites = 0;
  private scriptSnapshots: Map<string, ScriptSnapshotRecord> = new Map();
  private scriptSnapshotSeq = 0;
  private readonly maxSnapshots = 250;

  constructor(bridge: BridgeService) {
    this.client = new StudioHttpClient(bridge);
  }

  private hashSource(source: string) {
    return createHash('sha256').update(source, 'utf8').digest('hex');
  }

  private extractSource(response: any): string {
    if (response && typeof response.source === 'string') {
      return response.source;
    }
    return '';
  }

  private compactScriptWriteResponse(response: any) {
    const base = (response && typeof response === 'object') ? { ...response } : {};
    const payload = (base as any).propertyValue;
    delete (base as any).propertyValue;

    if (typeof payload === 'string') {
      (base as any).payloadBytes = Buffer.byteLength(payload, 'utf8');
      (base as any).payloadChars = payload.length;
    }

    return base;
  }

  private normalizeSource(source: string) {
    return source.replace(/\r\n/g, '\n');
  }

  private nextSnapshotId() {
    this.scriptSnapshotSeq += 1;
    return `ss_${this.scriptSnapshotSeq}`;
  }

  private pushSnapshot(instancePath: string, source: string, label?: string) {
    const normalized = this.normalizeSource(source);
    const record: ScriptSnapshotRecord = {
      id: this.nextSnapshotId(),
      instancePath,
      label: label || 'manual',
      source: normalized,
      sourceHash: this.hashSource(normalized),
      createdAt: Date.now(),
      sourceLength: normalized.length,
    };
    this.scriptSnapshots.set(record.id, record);
    if (this.scriptSnapshots.size > this.maxSnapshots) {
      const ordered = [...this.scriptSnapshots.values()].sort((a, b) => a.createdAt - b.createdAt);
      while (ordered.length > this.maxSnapshots) {
        const evict = ordered.shift();
        if (evict) {
          this.scriptSnapshots.delete(evict.id);
        }
      }
    }
    return record;
  }

  private async processWriteQueue() {
    if (this.writeInFlight || this.writeQueue.length === 0) {
      return;
    }

    this.writeQueue.sort((a, b) => {
      if (a.priority === b.priority) {
        return a.createdAt - b.createdAt;
      }
      return b.priority - a.priority;
    });

    const item = this.writeQueue.shift()!;
    if (item.cancelled) {
      item.reject(new Error(`Write job cancelled: ${item.label}`));
      void this.processWriteQueue();
      return;
    }

    this.writeInFlight = item;
    try {
      const result = await item.run();
      this.completedWrites += 1;
      item.resolve(result);
    } catch (error) {
      this.failedWrites += 1;
      item.reject(error);
    } finally {
      this.writeInFlight = null;
      void this.processWriteQueue();
    }
  }

  private enqueueWrite<T>(label: string, run: () => Promise<T>, priority: number = 0): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const item: WriteQueueItem<T> = {
        id: `wq_${++this.writeQueueSeq}`,
        priority,
        label,
        run,
        resolve,
        reject,
        createdAt: Date.now(),
        cancelled: false,
      };
      this.writeQueue.push(item);
      void this.processWriteQueue();
    });
  }

  getWriteQueueStats() {
    return {
      inFlight: this.writeInFlight ? {
        id: this.writeInFlight.id,
        label: this.writeInFlight.label,
        priority: this.writeInFlight.priority,
        ageMs: Date.now() - this.writeInFlight.createdAt,
      } : null,
      pending: this.writeQueue.length,
      pendingItems: this.writeQueue.map((x) => ({
        id: x.id,
        label: x.label,
        priority: x.priority,
        ageMs: Date.now() - x.createdAt,
      })),
      completedWrites: this.completedWrites,
      failedWrites: this.failedWrites,
    };
  }

  cancelPendingWrites(prefix?: string) {
    let cancelled = 0;
    for (const item of this.writeQueue) {
      if (!prefix || item.label.startsWith(prefix)) {
        item.cancelled = true;
        cancelled += 1;
      }
    }
    this.writeQueue = this.writeQueue.filter((x) => !x.cancelled);
    return { cancelled };
  }

  private async fastWriteSource(instancePath: string, source: string, verify: boolean = true) {
    if (this.fastEndpointSupport === 'no') {
      const fallback = await this.client.request('/api/set-property', {
        instancePath,
        propertyName: 'Source',
        propertyValue: source,
      });

      return this.compactScriptWriteResponse({
        ...fallback,
        method: 'fast-fallback-property',
        fallback: true,
        message: 'Script source updated via set_property fallback (plugin missing fast endpoint).',
      });
    }

    try {
      const response = await this.client.request('/api/set-script-source-fast', {
        instancePath,
        source,
        verify,
      });
      this.fastEndpointSupport = 'yes';
      return this.compactScriptWriteResponse({
        ...response,
        fallback: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('Unknown endpoint: /api/set-script-source-fast')) {
        throw error;
      }
      this.fastEndpointSupport = 'no';

      // Backward-compatible fallback for older plugin versions.
      const fallback = await this.client.request('/api/set-property', {
        instancePath,
        propertyName: 'Source',
        propertyValue: source,
      });

      return this.compactScriptWriteResponse({
        ...fallback,
        method: 'fast-fallback-property',
        fallback: true,
        message: 'Script source updated via set_property fallback (plugin missing fast endpoint).',
      });
    }
  }

  // File System Tools
  async getFileTree(path: string = '') {
    const response = await this.client.request('/api/file-tree', { path });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async searchFiles(query: string, searchType: string = 'name') {
    const response = await this.client.request('/api/search-files', { query, searchType });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  // Studio Context Tools
  async getPlaceInfo() {
    const response = await this.client.request('/api/place-info', {});
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async getServices(serviceName?: string) {
    const response = await this.client.request('/api/services', { serviceName });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async searchObjects(query: string, searchType: string = 'name', propertyName?: string) {
    const response = await this.client.request('/api/search-objects', { 
      query, 
      searchType, 
      propertyName 
    });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  // Property & Instance Tools
  async getInstanceProperties(instancePath: string) {
    if (!instancePath) {
      throw new Error('Instance path is required for get_instance_properties');
    }
    const response = await this.client.request('/api/instance-properties', { instancePath });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async getInstanceChildren(instancePath: string) {
    if (!instancePath) {
      throw new Error('Instance path is required for get_instance_children');
    }
    const response = await this.client.request('/api/instance-children', { instancePath });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async searchByProperty(propertyName: string, propertyValue: string) {
    if (!propertyName || !propertyValue) {
      throw new Error('Property name and value are required for search_by_property');
    }
    const response = await this.client.request('/api/search-by-property', { 
      propertyName, 
      propertyValue 
    });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async getClassInfo(className: string) {
    if (!className) {
      throw new Error('Class name is required for get_class_info');
    }
    const response = await this.client.request('/api/class-info', { className });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  // Project Tools
  async getProjectStructure(path?: string, maxDepth?: number, scriptsOnly?: boolean) {
    const response = await this.client.request('/api/project-structure', { 
      path, 
      maxDepth, 
      scriptsOnly 
    });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }


  // Property Modification Tools
  async setProperty(instancePath: string, propertyName: string, propertyValue: any) {
    if (!instancePath || !propertyName) {
      throw new Error('Instance path and property name are required for set_property');
    }
    const response = await this.client.request('/api/set-property', { 
      instancePath, 
      propertyName, 
      propertyValue 
    });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async massSetProperty(paths: string[], propertyName: string, propertyValue: any) {
    if (!paths || paths.length === 0 || !propertyName) {
      throw new Error('Paths array and property name are required for mass_set_property');
    }
    const response = await this.client.request('/api/mass-set-property', { 
      paths, 
      propertyName, 
      propertyValue 
    });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async massGetProperty(paths: string[], propertyName: string) {
    if (!paths || paths.length === 0 || !propertyName) {
      throw new Error('Paths array and property name are required for mass_get_property');
    }
    const response = await this.client.request('/api/mass-get-property', { 
      paths, 
      propertyName
    });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  // Object Creation Tools
  async createObject(className: string, parent: string, name?: string) {
    if (!className || !parent) {
      throw new Error('Class name and parent are required for create_object');
    }
    const response = await this.client.request('/api/create-object', { 
      className, 
      parent, 
      name
    });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async createObjectWithProperties(className: string, parent: string, name?: string, properties?: Record<string, any>) {
    if (!className || !parent) {
      throw new Error('Class name and parent are required for create_object_with_properties');
    }
    const response = await this.client.request('/api/create-object', { 
      className, 
      parent, 
      name, 
      properties 
    });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async massCreateObjects(objects: Array<{className: string, parent: string, name?: string}>) {
    if (!objects || objects.length === 0) {
      throw new Error('Objects array is required for mass_create_objects');
    }
    const response = await this.client.request('/api/mass-create-objects', { objects });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async massCreateObjectsWithProperties(objects: Array<{className: string, parent: string, name?: string, properties?: Record<string, any>}>) {
    if (!objects || objects.length === 0) {
      throw new Error('Objects array is required for mass_create_objects_with_properties');
    }
    const response = await this.client.request('/api/mass-create-objects-with-properties', { objects });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async deleteObject(instancePath: string) {
    if (!instancePath) {
      throw new Error('Instance path is required for delete_object');
    }
    const response = await this.client.request('/api/delete-object', { instancePath });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  // Smart Duplication Tools
  async smartDuplicate(
    instancePath: string, 
    count: number, 
    options?: {
      namePattern?: string; // e.g., "Button{n}" where {n} is replaced with index
      positionOffset?: [number, number, number]; // X, Y, Z offset per duplicate
      rotationOffset?: [number, number, number]; // X, Y, Z rotation offset per duplicate
      scaleOffset?: [number, number, number]; // X, Y, Z scale multiplier per duplicate
      propertyVariations?: Record<string, any[]>; // Property name to array of values
      targetParents?: string[]; // Different parent for each duplicate
    }
  ) {
    if (!instancePath || count < 1) {
      throw new Error('Instance path and count > 0 are required for smart_duplicate');
    }
    const response = await this.client.request('/api/smart-duplicate', { 
      instancePath, 
      count, 
      options 
    });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async massDuplicate(
    duplications: Array<{
      instancePath: string;
      count: number;
      options?: {
        namePattern?: string;
        positionOffset?: [number, number, number];
        rotationOffset?: [number, number, number];
        scaleOffset?: [number, number, number];
        propertyVariations?: Record<string, any[]>;
        targetParents?: string[];
      }
    }>
  ) {
    if (!duplications || duplications.length === 0) {
      throw new Error('Duplications array is required for mass_duplicate');
    }
    const response = await this.client.request('/api/mass-duplicate', { duplications });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  // Calculated Property Tools
  async setCalculatedProperty(
    paths: string[], 
    propertyName: string, 
    formula: string,
    variables?: Record<string, any>
  ) {
    if (!paths || paths.length === 0 || !propertyName || !formula) {
      throw new Error('Paths, property name, and formula are required for set_calculated_property');
    }
    const response = await this.client.request('/api/set-calculated-property', { 
      paths, 
      propertyName, 
      formula,
      variables
    });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  // Relative Property Tools
  async setRelativeProperty(
    paths: string[], 
    propertyName: string, 
    operation: 'add' | 'multiply' | 'divide' | 'subtract' | 'power',
    value: any,
    component?: 'X' | 'Y' | 'Z' | 'XScale' | 'XOffset' | 'YScale' | 'YOffset' // Vector3: X,Y,Z; UDim2: XScale, XOffset, YScale, YOffset
  ) {
    if (!paths || paths.length === 0 || !propertyName || !operation || value === undefined) {
      throw new Error('Paths, property name, operation, and value are required for set_relative_property');
    }
    const response = await this.client.request('/api/set-relative-property', { 
      paths, 
      propertyName, 
      operation,
      value,
      component
    });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  // Script Management Tools
  async getScriptSource(instancePath: string, startLine?: number, endLine?: number) {
    if (!instancePath) {
      throw new Error('Instance path is required for get_script_source');
    }
    const response = await this.client.request('/api/get-script-source', { instancePath, startLine, endLine });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async getRuntimeState() {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            writeQueue: this.getWriteQueueStats(),
            fastEndpointSupport: this.fastEndpointSupport,
            snapshots: {
              count: this.scriptSnapshots.size,
              max: this.maxSnapshots,
            },
          }, null, 2)
        }
      ]
    };
  }

  async getDiagnostics() {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            runtime: {
              writeQueue: this.getWriteQueueStats(),
              fastEndpointSupport: this.fastEndpointSupport,
            },
            snapshots: {
              count: this.scriptSnapshots.size,
              max: this.maxSnapshots,
              latest: [...this.scriptSnapshots.values()]
                .sort((a, b) => b.createdAt - a.createdAt)
                .slice(0, 10)
                .map((x) => ({
                  id: x.id,
                  instancePath: x.instancePath,
                  label: x.label,
                  sourceHash: x.sourceHash,
                  sourceLength: x.sourceLength,
                  createdAt: x.createdAt,
                })),
            },
          }, null, 2)
        }
      ]
    };
  }

  async createScriptSnapshot(instancePath: string, label?: string) {
    if (!instancePath) {
      throw new Error('Instance path is required for create_script_snapshot');
    }
    const response = await this.client.request('/api/get-script-source', { instancePath, fullSource: true });
    const source = this.extractSource(response);
    const record = this.pushSnapshot(instancePath, source, label);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            snapshotId: record.id,
            instancePath: record.instancePath,
            label: record.label,
            sourceHash: record.sourceHash,
            sourceLength: record.sourceLength,
            createdAt: record.createdAt,
          }, null, 2)
        }
      ]
    };
  }

  async listScriptSnapshots(instancePath?: string) {
    const list = [...this.scriptSnapshots.values()]
      .filter((x) => !instancePath || x.instancePath === instancePath)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((x) => ({
        id: x.id,
        instancePath: x.instancePath,
        label: x.label,
        sourceHash: x.sourceHash,
        sourceLength: x.sourceLength,
        createdAt: x.createdAt,
      }));
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            count: list.length,
            snapshots: list,
          }, null, 2)
        }
      ]
    };
  }

  async rollbackScriptSnapshot(snapshotId: string, verify: boolean = true) {
    if (!snapshotId) {
      throw new Error('Snapshot id is required for rollback_script_snapshot');
    }
    const record = this.scriptSnapshots.get(snapshotId);
    if (!record) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    const response = await this.enqueueWrite(
      `rollback_script_snapshot:${record.instancePath}`,
      async () => this.fastWriteSource(record.instancePath, record.source, verify),
      12,
    );

    const verifyResponse = await this.client.request('/api/get-script-source', { instancePath: record.instancePath, fullSource: true });
    const currentSource = this.normalizeSource(this.extractSource(verifyResponse));
    const currentHash = this.hashSource(currentSource);
    const restored = currentHash === record.sourceHash;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: restored,
            snapshotId: record.id,
            instancePath: record.instancePath,
            expectedHash: record.sourceHash,
            currentHash,
            response,
          }, null, 2)
        }
      ]
    };
  }

  async applyAndVerifyScriptSource(
    instancePath: string,
    source: string,
    expectedHash?: string,
    verifyNeedle?: string,
    rollbackOnFailure: boolean = true,
    preferFast?: boolean,
  ) {
    if (!instancePath || typeof source !== 'string') {
      throw new Error('Instance path and source are required for apply_and_verify_script_source');
    }

    const beforeResponse = await this.client.request('/api/get-script-source', { instancePath, fullSource: true });
    const beforeSource = this.normalizeSource(this.extractSource(beforeResponse));
    const beforeHash = this.hashSource(beforeSource);
    if (expectedHash && expectedHash !== beforeHash) {
      throw new Error(`Expected hash mismatch for ${instancePath}. Expected ${expectedHash} but found ${beforeHash}.`);
    }

    const snapshot = this.pushSnapshot(instancePath, beforeSource, 'apply_and_verify:prewrite');
    const useFast = preferFast === true || source.length > RobloxStudioTools.DIRECT_WRITE_THRESHOLD;
    const normalizedTarget = this.normalizeSource(source);
    const targetHash = this.hashSource(normalizedTarget);

    let writeResponse: any;
    try {
      writeResponse = await this.enqueueWrite(
        `apply_and_verify:${instancePath}`,
        async () => (useFast
          ? this.fastWriteSource(instancePath, source, true)
          : this.client.request('/api/set-script-source', { instancePath, source, preferDirect: false })),
        11,
      );
    } catch (error) {
      throw new Error(`Failed to apply source for ${instancePath}: ${error instanceof Error ? error.message : String(error)}`);
    }

    const afterResponse = await this.client.request('/api/get-script-source', { instancePath, fullSource: true });
    const afterSource = this.normalizeSource(this.extractSource(afterResponse));
    const afterHash = this.hashSource(afterSource);
    const matchesHash = afterHash === targetHash;
    const matchesNeedle = typeof verifyNeedle === 'string' ? afterSource.includes(verifyNeedle) : true;

    if (matchesHash && matchesNeedle) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              instancePath,
              snapshotId: snapshot.id,
              beforeHash,
              targetHash,
              afterHash,
              verifyNeedle: verifyNeedle || null,
              writeResponse: this.compactScriptWriteResponse(writeResponse),
            }, null, 2)
          }
        ]
      };
    }

    let rollbackStatus: 'skipped' | 'succeeded' | 'failed' = 'skipped';
    if (rollbackOnFailure) {
      try {
        await this.enqueueWrite(
          `apply_and_verify_rollback:${instancePath}`,
          async () => this.fastWriteSource(instancePath, beforeSource, true),
          13,
        );
        rollbackStatus = 'succeeded';
      } catch {
        rollbackStatus = 'failed';
      }
    }

    throw new Error(
      `Post-write verification failed for ${instancePath}. ` +
      `hashMatch=${matchesHash}, needleMatch=${matchesNeedle}, rollback=${rollbackStatus}, snapshotId=${snapshot.id}`
    );
  }

  async checkScriptDrift(
    mappings: Array<{ instancePath: string; localFile: string }>,
    normalizeLineEndings: boolean = true,
  ) {
    if (!Array.isArray(mappings) || mappings.length === 0) {
      throw new Error('At least one mapping is required for check_script_drift');
    }

    const results: Array<any> = [];
    for (const mapping of mappings) {
      const instancePath = mapping?.instancePath;
      const localFile = mapping?.localFile;
      if (!instancePath || !localFile) {
        results.push({
          instancePath: instancePath || null,
          localFile: localFile || null,
          status: 'invalid',
          reason: 'instancePath and localFile are required',
        });
        continue;
      }

      let localSource = '';
      try {
        localSource = await readFile(localFile, 'utf8');
      } catch (error) {
        results.push({
          instancePath,
          localFile,
          status: 'local-read-error',
          reason: error instanceof Error ? error.message : String(error),
        });
        continue;
      }

      let studioSource = '';
      try {
        const studio = await this.client.request('/api/get-script-source', { instancePath, fullSource: true });
        studioSource = this.extractSource(studio);
      } catch (error) {
        results.push({
          instancePath,
          localFile,
          status: 'studio-read-error',
          reason: error instanceof Error ? error.message : String(error),
        });
        continue;
      }

      const normalizedLocal = normalizeLineEndings ? this.normalizeSource(localSource) : localSource;
      const normalizedStudio = normalizeLineEndings ? this.normalizeSource(studioSource) : studioSource;
      const localHash = this.hashSource(normalizedLocal);
      const studioHash = this.hashSource(normalizedStudio);
      results.push({
        instancePath,
        localFile,
        status: localHash === studioHash ? 'in-sync' : 'drift',
        localHash,
        studioHash,
        localLength: normalizedLocal.length,
        studioLength: normalizedStudio.length,
      });
    }

    const summary = {
      total: results.length,
      inSync: results.filter((x) => x.status === 'in-sync').length,
      drift: results.filter((x) => x.status === 'drift').length,
      failures: results.filter((x) => x.status !== 'in-sync' && x.status !== 'drift').length,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ summary, results }, null, 2)
        }
      ]
    };
  }

  async lintDeprecatedApis(rootPath: string = process.cwd()) {
    const findings: Array<{ file: string; line: number; match: string; suggestion: string }> = [];
    const ignores = new Set(['node_modules', '.git', 'dist']);
    const exts = new Set(['.lua', '.luau']);
    const target = 'GetCollisionGroups';

    const walk = async (dir: string): Promise<void> => {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!ignores.has(entry.name)) {
            await walk(full);
          }
          continue;
        }
        const ext = path.extname(entry.name).toLowerCase();
        if (!exts.has(ext)) {
          continue;
        }
        let source = '';
        try {
          source = await readFile(full, 'utf8');
        } catch {
          continue;
        }
        const lines = source.split(/\r?\n/);
        for (let i = 0; i < lines.length; i += 1) {
          if (lines[i].includes(target)) {
            findings.push({
              file: full,
              line: i + 1,
              match: target,
              suggestion: 'Use PhysicsService:GetRegisteredCollisionGroups() instead.',
            });
          }
        }
      }
    };

    await walk(rootPath);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            rootPath,
            findings,
            totalFindings: findings.length,
          }, null, 2)
        }
      ]
    };
  }

  async getScriptSnapshot(instancePath: string, startLine?: number, endLine?: number) {
    if (!instancePath) {
      throw new Error('Instance path is required for get_script_snapshot');
    }

    const response = await this.client.request('/api/get-script-source', {
      instancePath,
      startLine,
      endLine,
      fullSource: !startLine && !endLine,
    });
    const source = this.extractSource(response);
    const snapshot = {
      ...response,
      sourceHash: this.hashSource(source),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(snapshot, null, 2)
        }
      ]
    };
  }

  async setScriptSource(instancePath: string, source: string, expectedHash?: string) {
    if (!instancePath || typeof source !== 'string') {
      throw new Error('Instance path and source code string are required for set_script_source');
    }

    let currentHash: string | null = null;
    if (expectedHash) {
      const snapshotResponse = await this.client.request('/api/get-script-source', { instancePath, fullSource: true });
      const currentSource = this.extractSource(snapshotResponse);
      currentHash = this.hashSource(currentSource);
      if (currentHash !== expectedHash) {
        throw new Error(
          `Script hash mismatch for ${instancePath}. Expected ${expectedHash} but found ${currentHash}. Reload the script and reapply your edit.`
        );
      }
    }

    const response = await this.enqueueWrite(
      `set_script_source:${instancePath}`,
      async () => {
        const useFastPath = source.length > RobloxStudioTools.DIRECT_WRITE_THRESHOLD;
        return useFastPath
          ? this.fastWriteSource(instancePath, source, true)
          : this.client.request('/api/set-script-source', {
              instancePath,
              source,
              preferDirect: false,
            });
      },
      5,
    );
    let newHash: string | null = null;
    if (expectedHash) {
      const updatedSource = await this.client.request('/api/get-script-source', { instancePath, fullSource: true });
      newHash = this.hashSource(this.extractSource(updatedSource));
    }

    const payload = {
      ...this.compactScriptWriteResponse(response),
      expectedHash: expectedHash || null,
      previousHash: currentHash,
      newHash
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(payload, null, 2)
        }
      ]
    };
  }

  async setScriptSourceChecked(instancePath: string, source: string, expectedHash: string) {
    if (!expectedHash) {
      throw new Error('Expected hash is required for set_script_source_checked');
    }
    return this.setScriptSource(instancePath, source, expectedHash);
  }

  async setScriptSourceFast(instancePath: string, source: string, verify: boolean = true) {
    if (!instancePath || typeof source !== 'string') {
      throw new Error('Instance path and source code string are required for set_script_source_fast');
    }
    const response = await this.enqueueWrite(
      `set_script_source_fast:${instancePath}`,
      async () => this.fastWriteSource(instancePath, source, verify),
      10,
    );
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async setScriptSourceFastGzip(instancePath: string, sourceGzipBase64: string, verify: boolean = true) {
    if (!instancePath || typeof sourceGzipBase64 !== 'string' || sourceGzipBase64.length === 0) {
      throw new Error('Instance path and sourceGzipBase64 are required for set_script_source_fast_gzip');
    }
    const source = gunzipSync(Buffer.from(sourceGzipBase64, 'base64')).toString('utf8');
    return this.setScriptSourceFast(instancePath, source, verify);
  }

  // Partial Script Editing Tools
  async editScriptLines(instancePath: string, startLine: number, endLine: number, newContent: string) {
    if (!instancePath || !startLine || !endLine || typeof newContent !== 'string') {
      throw new Error('Instance path, startLine, endLine, and newContent are required for edit_script_lines');
    }
    const response = await this.enqueueWrite(
      `edit_script_lines:${instancePath}`,
      async () => this.client.request('/api/edit-script-lines', { instancePath, startLine, endLine, newContent }),
      8,
    );
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async batchScriptEdits(
    instancePath: string,
    operations: ScriptEditOperation[],
    expectedHash?: string,
    rollbackOnFailure: boolean = true,
    fastMode: boolean = false
  ) {
    if (!instancePath) {
      throw new Error('Instance path is required for batch_script_edits');
    }
    if (!Array.isArray(operations) || operations.length === 0) {
      throw new Error('At least one operation is required for batch_script_edits');
    }

    const needsSnapshot = Boolean(expectedHash) || rollbackOnFailure || !fastMode;
    let originalSource: string | null = null;
    let originalHash: string | null = null;

    if (needsSnapshot) {
      const snapshotResponse = await this.client.request('/api/get-script-source', { instancePath, fullSource: true });
      originalSource = this.extractSource(snapshotResponse);
      originalHash = this.hashSource(originalSource);
    }

    if (expectedHash && expectedHash !== originalHash) {
      throw new Error(
        `Script hash mismatch for ${instancePath}. Expected ${expectedHash} but found ${originalHash}.`
      );
    }

    try {
      await this.enqueueWrite(
        `batch_script_edits:${instancePath}`,
        async () => this.client.request('/api/batch-script-edits', {
          instancePath,
          operations,
          rollbackOnFailure
        }),
        9,
      );
    } catch (error) {
      let rollbackSucceeded = false;
      if (rollbackOnFailure && originalSource !== null) {
        try {
          await this.client.request('/api/set-script-source', {
            instancePath,
            source: originalSource,
            preferDirect: originalSource.length > RobloxStudioTools.DIRECT_WRITE_THRESHOLD,
          });
          rollbackSucceeded = true;
        } catch {
          rollbackSucceeded = false;
        }
      }

      throw new Error(
        `Batch edit failed for ${operations.length} operations. ` +
        `Rollback ${rollbackOnFailure ? (rollbackSucceeded ? 'succeeded' : 'failed') : 'skipped'}. ` +
        `Cause: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    let newHash: string | null = null;
    if (!fastMode) {
      const finalResponse = await this.client.request('/api/get-script-source', { instancePath, fullSource: true });
      newHash = this.hashSource(this.extractSource(finalResponse));
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            instancePath,
            operationsApplied: operations.length,
            originalHash,
            newHash,
            fastMode
          }, null, 2)
        }
      ]
    };
  }

  async insertScriptLines(instancePath: string, afterLine: number, newContent: string) {
    if (!instancePath || typeof newContent !== 'string') {
      throw new Error('Instance path and newContent are required for insert_script_lines');
    }
    const response = await this.enqueueWrite(
      `insert_script_lines:${instancePath}`,
      async () => this.client.request('/api/insert-script-lines', { instancePath, afterLine: afterLine || 0, newContent }),
      8,
    );
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async deleteScriptLines(instancePath: string, startLine: number, endLine: number) {
    if (!instancePath || !startLine || !endLine) {
      throw new Error('Instance path, startLine, and endLine are required for delete_script_lines');
    }
    const response = await this.enqueueWrite(
      `delete_script_lines:${instancePath}`,
      async () => this.client.request('/api/delete-script-lines', { instancePath, startLine, endLine }),
      8,
    );
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  // Attribute Tools
  async getAttribute(instancePath: string, attributeName: string) {
    if (!instancePath || !attributeName) {
      throw new Error('Instance path and attribute name are required for get_attribute');
    }
    const response = await this.client.request('/api/get-attribute', { instancePath, attributeName });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async setAttribute(instancePath: string, attributeName: string, attributeValue: any, valueType?: string) {
    if (!instancePath || !attributeName) {
      throw new Error('Instance path and attribute name are required for set_attribute');
    }
    const response = await this.client.request('/api/set-attribute', { instancePath, attributeName, attributeValue, valueType });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async getAttributes(instancePath: string) {
    if (!instancePath) {
      throw new Error('Instance path is required for get_attributes');
    }
    const response = await this.client.request('/api/get-attributes', { instancePath });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async deleteAttribute(instancePath: string, attributeName: string) {
    if (!instancePath || !attributeName) {
      throw new Error('Instance path and attribute name are required for delete_attribute');
    }
    const response = await this.client.request('/api/delete-attribute', { instancePath, attributeName });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  // Tag Tools (CollectionService)
  async getTags(instancePath: string) {
    if (!instancePath) {
      throw new Error('Instance path is required for get_tags');
    }
    const response = await this.client.request('/api/get-tags', { instancePath });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async addTag(instancePath: string, tagName: string) {
    if (!instancePath || !tagName) {
      throw new Error('Instance path and tag name are required for add_tag');
    }
    const response = await this.client.request('/api/add-tag', { instancePath, tagName });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async removeTag(instancePath: string, tagName: string) {
    if (!instancePath || !tagName) {
      throw new Error('Instance path and tag name are required for remove_tag');
    }
    const response = await this.client.request('/api/remove-tag', { instancePath, tagName });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async getTagged(tagName: string) {
    if (!tagName) {
      throw new Error('Tag name is required for get_tagged');
    }
    const response = await this.client.request('/api/get-tagged', { tagName });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async getSelection() {
    const response = await this.client.request('/api/get-selection', {});
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async executeLuau(code: string) {
    if (!code) {
      throw new Error('Code is required for execute_luau');
    }
    const response = await this.client.request('/api/execute-luau', { code });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async startPlaytest(mode: string) {
    if (mode !== 'play' && mode !== 'run') {
      throw new Error('mode must be "play" or "run"');
    }
    const response = await this.client.request('/api/start-playtest', { mode });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async stopPlaytest() {
    const response = await this.client.request('/api/stop-playtest', {});
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  async getPlaytestOutput() {
    const response = await this.client.request('/api/get-playtest-output', {});
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }
}
