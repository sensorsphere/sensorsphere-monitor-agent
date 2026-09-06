import os from "node:os";
import type { SensorSphereClient } from "../api/client.js";
import { AuthenticationError } from "../api/client.js";
import type { AgentConfig } from "../config/env.js";
import type { StateStore } from "../persistence/state-store.js";
import type { CheckResult } from "../types/monitoring.js";
import type { Logger } from "../util/logger.js";
import { AGENT_VERSION } from "../version.js";
import type { CheckScheduler } from "./scheduler.js";

export class MonitorAgent {
  private stopped = false;
  private serverRevision: number | null = null;
  private connected = false;
  private flushRunning = false;
  private heartbeatTimer?: NodeJS.Timeout;
  private configTimer?: NodeJS.Timeout;

  constructor(
    private readonly config: AgentConfig,
    private readonly client: SensorSphereClient,
    private readonly stateStore: StateStore,
    private readonly scheduler: CheckScheduler,
    private readonly logger: Logger,
  ) {}

  async start(): Promise<void> {
    const state = await this.stateStore.load();
    if (state.checks.length > 0) {
      this.scheduler.reconcile(state.checks);
      this.logger.info("Loaded cached monitoring configuration", { revision: state.configRevision, checks: state.checks.length });
    }
    if (state.queuedResults.length > 0) this.logger.warn("Loaded queued monitoring results", { queuedResults: state.queuedResults.length });

    this.logger.info("SensorSphere Monitor Agent starting", {
      version: AGENT_VERSION,
      agentId: this.config.agentId,
      sensorSphereUrl: this.config.sensorSphereUrl,
      hostname: os.hostname(),
    });

    await this.heartbeatOnce();
    await this.refreshConfig();
    await this.flushQueuedResults();

    this.heartbeatTimer = setInterval(() => { void this.guard(() => this.heartbeatOnce()); }, this.config.heartbeatIntervalMs);
    this.configTimer = setInterval(() => { void this.guard(() => this.refreshConfig()); }, this.config.configPollIntervalMs);
  }

  async handleResult(result: CheckResult): Promise<void> {
    const queued = this.stateStore.getState().queuedResults.length;
    if (queued > 0) {
      const count = await this.stateStore.enqueue(result);
      this.logger.warn("Result queued behind offline backlog", { checkId: result.checkId, queuedResults: count });
      void this.flushQueuedResults();
      return;
    }

    try {
      await this.client.submitResults([result]);
      this.markConnected();
    } catch (error) {
      if (error instanceof AuthenticationError) return this.fatal(error);
      const count = await this.stateStore.enqueue(result);
      this.markDisconnected(error);
      this.logger.warn("Monitoring result queued locally", { checkId: result.checkId, queuedResults: count });
    }
  }

  stop(): void {
    this.stopped = true;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.configTimer) clearInterval(this.configTimer);
    this.scheduler.stop();
    this.logger.info("SensorSphere Monitor Agent stopped");
  }

  private async heartbeatOnce(): Promise<void> {
    if (this.stopped) return;
    try {
      const response = await this.client.heartbeat({
        version: AGENT_VERSION,
        hostname: os.hostname(),
        ...(Object.keys(this.config.labels).length > 0 ? { labels: this.config.labels } : {}),
      });
      this.markConnected();
      if (this.serverRevision !== response.configRevision) {
        this.serverRevision = response.configRevision;
      }
      this.logger.debug("Heartbeat accepted", { serverAgentId: response.agentId, configRevision: response.configRevision });
      void this.flushQueuedResults();
    } catch (error) {
      if (error instanceof AuthenticationError) return this.fatal(error);
      this.markDisconnected(error);
    }
  }

  private async refreshConfig(): Promise<void> {
    if (this.stopped) return;
    try {
      const response = await this.client.getAssignedChecks();
      this.markConnected();
      const previousRevision = this.stateStore.getState().configRevision;
      if (previousRevision !== response.revision) {
        await this.stateStore.setConfig(response.revision, response.checks);
        this.scheduler.reconcile(response.checks);
        this.logger.info("Monitoring configuration updated", {
          previousRevision,
          revision: response.revision,
          activeChecks: response.checks.filter((check) => check.type.toUpperCase() === "PING").length,
          assignedChecks: response.checks.length,
        });
      }
      this.serverRevision = response.revision;
    } catch (error) {
      if (error instanceof AuthenticationError) return this.fatal(error);
      this.markDisconnected(error);
    }
  }

  private async flushQueuedResults(): Promise<void> {
    if (this.flushRunning || this.stopped) return;
    this.flushRunning = true;
    try {
      while (!this.stopped) {
        const queued = this.stateStore.getState().queuedResults;
        if (queued.length === 0) return;
        const batch = queued.slice(0, 1000);
        try {
          await this.client.submitResults(batch.map(({ queuedAt: _queuedAt, ...result }) => result));
          await this.stateStore.removeQueued(batch.length);
          this.markConnected();
          this.logger.info("Flushed queued monitoring results", {
            flushed: batch.length,
            remaining: this.stateStore.getState().queuedResults.length,
          });
        } catch (error) {
          if (error instanceof AuthenticationError) return this.fatal(error);
          this.markDisconnected(error);
          return;
        }
      }
    } finally {
      this.flushRunning = false;
    }
  }

  private markConnected(): void {
    if (!this.connected) this.logger.info("Connected and authenticated to SensorSphere");
    this.connected = true;
  }

  private markDisconnected(error: unknown): void {
    if (this.connected) this.logger.warn("SensorSphere became unreachable", { error: (error as Error).message });
    else this.logger.warn("SensorSphere unreachable; continuing with cached checks", { error: (error as Error).message });
    this.connected = false;
  }

  private fatal(error: Error): never {
    this.logger.error("Authentication failure; stopping agent", { error: error.message });
    this.stop();
    process.exitCode = 1;
    throw error;
  }

  private async guard(operation: () => Promise<void>): Promise<void> {
    try {
      await operation();
    } catch (error) {
      if (!this.stopped) this.logger.error("Agent loop failure", { error: (error as Error).message });
    }
  }
}
