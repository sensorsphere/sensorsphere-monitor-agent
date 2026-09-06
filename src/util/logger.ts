type LogLevel = "debug" | "info" | "warn" | "error";

const priorities: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class Logger {
  constructor(private readonly level: LogLevel) {}

  debug(message: string, fields?: Record<string, unknown>): void { this.write("debug", message, fields); }
  info(message: string, fields?: Record<string, unknown>): void { this.write("info", message, fields); }
  warn(message: string, fields?: Record<string, unknown>): void { this.write("warn", message, fields); }
  error(message: string, fields?: Record<string, unknown>): void { this.write("error", message, fields); }

  private write(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
    if (priorities[level] < priorities[this.level]) return;
    const record = { ...(fields ?? {}), timestamp: new Date().toISOString(), level, message };
    const line = JSON.stringify(record);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }
}

export function parseLogLevel(value: string): LogLevel {
  return value === "debug" || value === "warn" || value === "error" ? value : "info";
}
