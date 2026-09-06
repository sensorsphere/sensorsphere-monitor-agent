import fs from "node:fs/promises";
import path from "node:path";
import type { PersistedState, QueuedResult } from "../types/monitoring.js";
import type { Logger } from "../util/logger.js";

const EMPTY_STATE: PersistedState = {
  schemaVersion: 1,
  configRevision: null,
  checks: [],
  queuedResults: [],
  updatedAt: new Date(0).toISOString(),
};

function validateState(value: unknown): PersistedState {
  if (!value || typeof value !== "object") throw new Error("state is not an object");
  const state = value as Partial<PersistedState>;
  if (state.schemaVersion !== 1) throw new Error(`unsupported state schema version ${String(state.schemaVersion)}`);
  if (!Array.isArray(state.checks) || !Array.isArray(state.queuedResults)) throw new Error("state arrays are invalid");
  if (state.configRevision !== null && typeof state.configRevision !== "number") throw new Error("configRevision is invalid");
  return state as PersistedState;
}

export class StateStore {
  private state: PersistedState = { ...EMPTY_STATE, checks: [], queuedResults: [] };
  private operation: Promise<void> = Promise.resolve();

  constructor(
    private readonly filePath: string,
    private readonly queueMaxResults: number,
    private readonly queueRetentionMs: number,
    private readonly logger: Logger,
  ) {}

  async load(): Promise<PersistedState> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      this.state = await this.readValid(this.filePath);
      this.pruneQueue();
      return this.snapshot();
    } catch (primaryError) {
      if ((primaryError as NodeJS.ErrnoException).code === "ENOENT") {
        try {
          this.state = await this.readValid(`${this.filePath}.bak`);
          this.logger.warn("Primary state file missing; recovered from backup", { stateFile: this.filePath });
          this.pruneQueue();
          return this.snapshot();
        } catch (backupError) {
          if ((backupError as NodeJS.ErrnoException).code !== "ENOENT") throw new Error(`State backup is invalid: ${(backupError as Error).message}`);
          this.state = { ...EMPTY_STATE, checks: [], queuedResults: [], updatedAt: new Date().toISOString() };
          return this.snapshot();
        }
      }

      this.logger.error("Primary state file is invalid; attempting backup recovery", { error: (primaryError as Error).message });
      try {
        this.state = await this.readValid(`${this.filePath}.bak`);
        this.logger.warn("Recovered monitoring state from backup", { stateFile: `${this.filePath}.bak` });
        this.pruneQueue();
        return this.snapshot();
      } catch (backupError) {
        throw new Error(`Refusing to replace invalid monitoring state. Primary error: ${(primaryError as Error).message}; backup error: ${(backupError as Error).message}`);
      }
    }
  }

  getState(): PersistedState { return this.snapshot(); }

  setConfig(configRevision: number, checks: PersistedState["checks"]): Promise<void> {
    return this.exclusive(async () => {
      this.state.configRevision = configRevision;
      this.state.checks = structuredClone(checks);
      await this.save();
    });
  }

  enqueue(result: Omit<QueuedResult, "queuedAt">): Promise<number> {
    return this.exclusive(async () => {
      this.state.queuedResults.push({ ...result, queuedAt: new Date().toISOString() });
      this.pruneQueue();
      await this.save();
      return this.state.queuedResults.length;
    });
  }

  removeQueued(count: number): Promise<void> {
    return this.exclusive(async () => {
      this.state.queuedResults.splice(0, count);
      await this.save();
    });
  }

  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.operation.then(fn, fn);
    this.operation = result.then(() => undefined, () => undefined);
    return result;
  }

  private pruneQueue(): void {
    const cutoff = Date.now() - this.queueRetentionMs;
    this.state.queuedResults = this.state.queuedResults.filter((item) => Date.parse(item.queuedAt) >= cutoff);
    if (this.state.queuedResults.length > this.queueMaxResults) {
      this.state.queuedResults.splice(0, this.state.queuedResults.length - this.queueMaxResults);
    }
  }

  private async save(): Promise<void> {
    this.pruneQueue();
    this.state.updatedAt = new Date().toISOString();
    const tempPath = `${this.filePath}.tmp`;
    const backupPath = `${this.filePath}.bak`;
    const serialized = `${JSON.stringify(this.state, null, 2)}\n`;

    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(tempPath, serialized, { encoding: "utf8", mode: 0o600 });
    const handle = await fs.open(tempPath, "r");
    await handle.sync();
    await handle.close();

    try {
      await fs.copyFile(this.filePath, backupPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await fs.rename(tempPath, this.filePath);
  }

  private async readValid(file: string): Promise<PersistedState> {
    const text = await fs.readFile(file, "utf8");
    return validateState(JSON.parse(text));
  }

  private snapshot(): PersistedState { return structuredClone(this.state); }
}
