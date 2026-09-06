import { SensorSphereClient } from "./api/client.js";
import { PingExecutor } from "./checks/ping.js";
import { loadConfig } from "./config/env.js";
import { MonitorAgent } from "./core/agent.js";
import { CheckScheduler } from "./core/scheduler.js";
import { StateStore } from "./persistence/state-store.js";
import { Logger } from "./util/logger.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = new Logger(config.logLevel);
  const client = new SensorSphereClient(config);
  const stateStore = new StateStore(config.stateFile, config.queueMaxResults, config.queueRetentionMs, logger);

  let agent: MonitorAgent;
  const scheduler = new CheckScheduler(
    [new PingExecutor()],
    async (result) => agent.handleResult(result),
    logger,
  );
  agent = new MonitorAgent(config, client, stateStore, scheduler, logger);

  const shutdown = (signal: string): void => {
    logger.info("Shutdown signal received", { signal });
    agent.stop();
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  await agent.start();
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: "error", message: "Agent startup failed", error: message }));
  process.exitCode = 1;
});
