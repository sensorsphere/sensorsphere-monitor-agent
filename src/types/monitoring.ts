export type CheckType = "PING" | "TCP" | "HTTP" | "HTTPS" | string;
export type CheckStatus = "UP" | "DOWN" | "UNKNOWN";

export interface AssignedCheck {
  id: string;
  deviceId: string;
  deviceName: string;
  name: string;
  type: CheckType;
  target: string;
  targetMode: "PRIMARY_IP" | "PRIMARY_FQDN" | "PRIMARY_ADDRESS" | "CUSTOM" | string;
  port: number | null;
  path: string | null;
  intervalSeconds: number;
  timeoutSeconds: number;
  failureThreshold: number;
  recoveryThreshold: number;
  config: Record<string, unknown>;
}

export interface CheckResult {
  checkId: string;
  status: CheckStatus;
  startedAt: string;
  finishedAt: string;
  latencyMs: number | null;
  message: string | null;
}

export interface HeartbeatResponse {
  agentId: string;
  configRevision: number;
  serverTime: string;
}

export interface AssignedChecksResponse {
  agentId: string;
  revision: number;
  checks: AssignedCheck[];
}

export interface PersistedState {
  schemaVersion: 1;
  configRevision: number | null;
  checks: AssignedCheck[];
  queuedResults: QueuedResult[];
  updatedAt: string;
}

export interface QueuedResult extends CheckResult {
  queuedAt: string;
}
