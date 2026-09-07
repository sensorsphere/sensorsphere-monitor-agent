import path from "node:path";
import { parseLogLevel } from "../util/logger.js";

export interface AgentConfig {
  sensorSphereUrl: string;
  agentToken: string;
  heartbeatIntervalMs: number;
  configPollIntervalMs: number;
  requestTimeoutMs: number;
  stateFile: string;
  queueMaxResults: number;
  queueRetentionMs: number;
  logLevel: ReturnType<typeof parseLogLevel>;
  agentLabels: string[];
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

function parseAgentLabels(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const part of raw.split(",")) {
    const label = part.trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels;
}

export function loadConfig(): AgentConfig {
  const url = new URL(required("SENSORSPHERE_URL"));
  url.pathname = url.pathname.replace(/\/$/, "");

  const stateFile = process.env.SENSORSPHERE_STATE_FILE?.trim() || path.resolve("data/monitor-agent-state.json");
  return {
    sensorSphereUrl: url.toString().replace(/\/$/, ""),
    agentToken: required("SENSORSPHERE_AGENT_TOKEN"),
    heartbeatIntervalMs: positiveInt("SENSORSPHERE_HEARTBEAT_INTERVAL_SECONDS", 30) * 1000,
    configPollIntervalMs: positiveInt("SENSORSPHERE_CONFIG_POLL_INTERVAL_SECONDS", 15) * 1000,
    requestTimeoutMs: positiveInt("SENSORSPHERE_REQUEST_TIMEOUT_MS", 10000),
    stateFile,
    queueMaxResults: positiveInt("SENSORSPHERE_QUEUE_MAX_RESULTS", 10000),
    queueRetentionMs: positiveInt("SENSORSPHERE_QUEUE_RETENTION_HOURS", 72) * 60 * 60 * 1000,
    logLevel: parseLogLevel(process.env.SENSORSPHERE_LOG_LEVEL ?? "info"),
    agentLabels: parseAgentLabels(process.env.AGENT_LABELS),
  };
}
