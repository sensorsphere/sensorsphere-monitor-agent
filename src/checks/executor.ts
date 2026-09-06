import type { AssignedCheck, CheckResult } from "../types/monitoring.js";

export interface CheckExecutor {
  supports(type: string): boolean;
  execute(check: AssignedCheck): Promise<CheckResult>;
}
