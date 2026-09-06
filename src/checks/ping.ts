import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AssignedCheck, CheckResult } from "../types/monitoring.js";
import type { CheckExecutor } from "./executor.js";

const execFileAsync = promisify(execFile);

function parseLatency(output: string): number | null {
  const patterns = [
    /time[=<]\s*([0-9.]+)\s*ms/i,
    /Average = ([0-9]+)ms/i,
  ];
  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match) return Number.parseFloat(match[1]);
  }
  return null;
}

export class PingExecutor implements CheckExecutor {
  supports(type: string): boolean {
    return type.toUpperCase() === "PING";
  }

  async execute(check: AssignedCheck): Promise<CheckResult> {
    const startedAt = new Date();
    const timeoutMs = Math.max(1, check.timeoutSeconds) * 1000;

    try {
      const { stdout, stderr } = await execFileAsync("ping", this.args(check.target, check.timeoutSeconds), {
        timeout: timeoutMs + 1000,
        windowsHide: true,
        maxBuffer: 64 * 1024,
      });
      const finishedAt = new Date();
      const latencyMs = parseLatency(`${stdout}\n${stderr}`);
      return {
        checkId: check.id,
        status: "UP",
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        latencyMs,
        message: null,
      };
    } catch (error) {
      const finishedAt = new Date();
      const details = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string; killed?: boolean };
      const text = [details.stderr, details.stdout, details.message].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      return {
        checkId: check.id,
        status: "DOWN",
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        latencyMs: null,
        message: text.slice(0, 500) || "Ping failed",
      };
    }
  }

  private args(target: string, timeoutSeconds: number): string[] {
    if (process.platform === "win32") return ["-n", "1", "-w", String(Math.max(1, timeoutSeconds) * 1000), target];
    if (process.platform === "darwin") return ["-c", "1", "-W", String(Math.max(1, timeoutSeconds) * 1000), target];
    return ["-c", "1", "-W", String(Math.max(1, Math.ceil(timeoutSeconds))), target];
  }
}
