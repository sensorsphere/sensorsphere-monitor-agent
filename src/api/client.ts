import type { AgentConfig } from "../config/env.js";
import type { AssignedChecksResponse, CheckResult, HeartbeatResponse } from "../types/monitoring.js";

export class AuthenticationError extends Error {}
export class SensorSphereUnavailableError extends Error {}

export class SensorSphereClient {
  constructor(private readonly config: AgentConfig) {}

  heartbeat(payload: { version: string; hostname: string; agentLabels: string[] }): Promise<HeartbeatResponse> {
    return this.request<HeartbeatResponse>("POST", "/api/v1/monitoring/agent/heartbeat", payload);
  }

  getAssignedChecks(): Promise<AssignedChecksResponse> {
    return this.request<AssignedChecksResponse>("GET", "/api/v1/monitoring/agent/checks");
  }

  async submitResults(results: CheckResult[]): Promise<void> {
    if (results.length === 0) return;
    if (results.length > 1000) throw new Error("SensorSphere result batch exceeds API maximum of 1000");
    await this.request<unknown>("POST", "/api/v1/monitoring/agent/results", { results });
  }

  private async request<T>(method: string, route: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    try {
      const response = await fetch(`${this.config.sensorSphereUrl}${route}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.config.agentToken}`,
          Accept: "application/json",
          ...(this.config.agentName ? { "X-SensorSphere-Agent-Name": this.config.agentName } : {}),
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      if (response.status === 401) throw new AuthenticationError("SensorSphere rejected the monitoring agent token (401)");
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new SensorSphereUnavailableError(`SensorSphere API ${method} ${route} failed with HTTP ${response.status}${text ? `: ${text.slice(0, 300)}` : ""}`);
      }
      if (response.status === 204) return undefined as T;
      const text = await response.text();
      return (text ? JSON.parse(text) : undefined) as T;
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof SensorSphereUnavailableError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      throw new SensorSphereUnavailableError(`SensorSphere request failed: ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
