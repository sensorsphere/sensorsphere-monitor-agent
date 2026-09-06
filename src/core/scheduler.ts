import type { CheckExecutor } from "../checks/executor.js";
import type { AssignedCheck, CheckResult } from "../types/monitoring.js";
import type { Logger } from "../util/logger.js";

type ResultHandler = (result: CheckResult) => Promise<void>;

interface ScheduledCheck {
  check: AssignedCheck;
  timer: NodeJS.Timeout;
  running: boolean;
  signature: string;
}

export class CheckScheduler {
  private readonly scheduled = new Map<string, ScheduledCheck>();

  constructor(
    private readonly executors: CheckExecutor[],
    private readonly onResult: ResultHandler,
    private readonly logger: Logger,
  ) {}

  reconcile(checks: AssignedCheck[]): void {
    const incoming = new Map(checks.map((check) => [check.id, check]));

    for (const [id, current] of this.scheduled) {
      if (!incoming.has(id)) {
        clearInterval(current.timer);
        this.scheduled.delete(id);
        this.logger.info("Removed monitoring check schedule", { checkId: id, checkName: current.check.name });
      }
    }

    for (const check of checks) {
      const executor = this.executors.find((candidate) => candidate.supports(check.type));
      if (!executor) {
        this.logger.warn("No executor available for assigned check type", { checkId: check.id, type: check.type });
        continue;
      }
      const signature = JSON.stringify(check);
      const existing = this.scheduled.get(check.id);
      if (existing?.signature === signature) continue;
      if (existing) clearInterval(existing.timer);
      this.install(check, executor, signature);
    }

    this.logger.info("Monitoring schedules reconciled", { activeChecks: this.scheduled.size });
  }

  stop(): void {
    for (const item of this.scheduled.values()) clearInterval(item.timer);
    this.scheduled.clear();
  }

  private install(check: AssignedCheck, executor: CheckExecutor, signature: string): void {
    const state: ScheduledCheck = { check, timer: undefined as unknown as NodeJS.Timeout, running: false, signature };
    const run = async (): Promise<void> => {
      if (state.running) {
        this.logger.warn("Skipping overlapping check execution", { checkId: check.id, checkName: check.name });
        return;
      }
      state.running = true;
      try {
        const result = await executor.execute(check);
        if (result.status !== "UP") this.logger.warn("Monitoring check failed", { checkId: check.id, checkName: check.name, target: check.target, errorMessage: result.message });
        else this.logger.debug("Monitoring check succeeded", { checkId: check.id, latencyMs: result.latencyMs });
        await this.onResult(result);
      } catch (error) {
        this.logger.error("Unexpected check executor failure", { checkId: check.id, error: (error as Error).message });
      } finally {
        state.running = false;
      }
    };

    state.timer = setInterval(() => { void run(); }, Math.max(1, check.intervalSeconds) * 1000);
    this.scheduled.set(check.id, state);
    void run();
  }
}
