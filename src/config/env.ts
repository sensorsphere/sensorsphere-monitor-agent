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
  labels: Record<string, string>;
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

function parseLabels(raw: string | undefined): Record<string, string> {
  if (!raw?.trim()) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("SENSORSPHERE_AGENT_LABELS must be a JSON object");
  const labels: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string") throw new Error("SENSORSPHERE_AGENT_LABELS values must be strings");
    labels[key] = value;
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
    labels: parseLabels(process.env.SENSORSPHERE_AGENT_LABELS),
  };
}
