import { v4 as uuidv4 } from 'uuid';

interface PendingRequest {
  id: string;
  endpoint: string;
  data: any;
  timestamp: number;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

export class BridgeService {
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestTimeout = 30000; // 30 seconds timeout
  private totalRequests = 0;
  private totalResolved = 0;
  private totalRejected = 0;
  private totalTimeouts = 0;
  private totalLatencyMs = 0;
  private latencySamples: number[] = [];
  private maxLatencySamples = 500;
  private endpointStats: Map<string, { total: number; resolved: number; rejected: number; totalLatencyMs: number }> = new Map();

  async sendRequest(endpoint: string, data: any): Promise<any> {
    const requestId = uuidv4();
    this.totalRequests += 1;
    const endpointStat = this.endpointStats.get(endpoint) || { total: 0, resolved: 0, rejected: 0, totalLatencyMs: 0 };
    endpointStat.total += 1;
    this.endpointStats.set(endpoint, endpointStat);

    return new Promise((resolve, reject) => {
      // Set timeout and store the ID so we can clear it later
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.totalRejected += 1;
          this.totalTimeouts += 1;
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, this.requestTimeout);

      const request: PendingRequest = {
        id: requestId,
        endpoint,
        data,
        timestamp: Date.now(),
        resolve,
        reject,
        timeoutId
      };

      this.pendingRequests.set(requestId, request);
    });
  }

  getPendingRequest(): { requestId: string; request: { endpoint: string; data: any } } | null {
    // Get oldest pending request
    let oldestRequest: PendingRequest | null = null;
    
    for (const request of this.pendingRequests.values()) {
      if (!oldestRequest || request.timestamp < oldestRequest.timestamp) {
        oldestRequest = request;
      }
    }

    if (oldestRequest) {
      return {
        requestId: oldestRequest.id,
        request: {
          endpoint: oldestRequest.endpoint,
          data: oldestRequest.data
        }
      };
    }

    return null;
  }

  resolveRequest(requestId: string, response: any) {
    const request = this.pendingRequests.get(requestId);
    if (request) {
      const latency = Date.now() - request.timestamp;
      clearTimeout(request.timeoutId);
      this.pendingRequests.delete(requestId);
      this.totalResolved += 1;
      this.totalLatencyMs += latency;
      this.latencySamples.push(latency);
      if (this.latencySamples.length > this.maxLatencySamples) {
        this.latencySamples.shift();
      }
      const endpointStat = this.endpointStats.get(request.endpoint);
      if (endpointStat) {
        endpointStat.resolved += 1;
        endpointStat.totalLatencyMs += latency;
      }
      request.resolve(response);
    }
  }

  rejectRequest(requestId: string, error: any) {
    const request = this.pendingRequests.get(requestId);
    if (request) {
      clearTimeout(request.timeoutId);
      this.pendingRequests.delete(requestId);
      this.totalRejected += 1;
      const endpointStat = this.endpointStats.get(request.endpoint);
      if (endpointStat) {
        endpointStat.rejected += 1;
      }
      if (error instanceof Error && error.message === 'Request timeout') {
        this.totalTimeouts += 1;
      } else if (typeof error === 'string' && error.toLowerCase().includes('timeout')) {
        this.totalTimeouts += 1;
      }
      request.reject(error);
    }
  }

  // Clean up old requests
  cleanupOldRequests() {
    const now = Date.now();
    for (const [id, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > this.requestTimeout) {
        clearTimeout(request.timeoutId);
        this.pendingRequests.delete(id);
        this.totalRejected += 1;
        this.totalTimeouts += 1;
        const endpointStat = this.endpointStats.get(request.endpoint);
        if (endpointStat) {
          endpointStat.rejected += 1;
        }
        request.reject(new Error('Request timeout'));
      }
    }
  }

  // Force cleanup all pending requests (used on disconnect)
  clearAllPendingRequests() {
    for (const [, request] of this.pendingRequests.entries()) {
      clearTimeout(request.timeoutId);
      this.totalRejected += 1;
      const endpointStat = this.endpointStats.get(request.endpoint);
      if (endpointStat) {
        endpointStat.rejected += 1;
      }
      request.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
  }

  private percentile(samples: number[], p: number): number {
    if (samples.length === 0) return 0;
    const sorted = [...samples].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
    return sorted[idx];
  }

  getStats() {
    const p50 = this.percentile(this.latencySamples, 50);
    const p90 = this.percentile(this.latencySamples, 90);
    const p99 = this.percentile(this.latencySamples, 99);
    const endpoints = Array.from(this.endpointStats.entries()).map(([endpoint, stat]) => ({
      endpoint,
      total: stat.total,
      resolved: stat.resolved,
      rejected: stat.rejected,
      avgLatencyMs: stat.resolved > 0 ? Math.round(stat.totalLatencyMs / stat.resolved) : 0
    }));
    return {
      inFlightRequests: this.pendingRequests.size,
      totalRequests: this.totalRequests,
      totalResolved: this.totalResolved,
      totalRejected: this.totalRejected,
      totalTimeouts: this.totalTimeouts,
      averageLatencyMs: this.totalResolved > 0 ? Math.round(this.totalLatencyMs / this.totalResolved) : 0,
      p50LatencyMs: p50,
      p90LatencyMs: p90,
      p99LatencyMs: p99,
      latencySampleCount: this.latencySamples.length,
      endpoints
    };
  }
}
