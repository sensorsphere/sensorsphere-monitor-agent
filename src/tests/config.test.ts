import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../config/env.js";

const managedVariables = [
  "SENSORSPHERE_URL",
  "SENSORSPHERE_AGENT_ID",
  "SENSORSPHERE_AGENT_TOKEN",
] as const;

function withEnvironment(values: Record<string, string | undefined>, callback: () => void): void {
  const previous = Object.fromEntries(managedVariables.map((name) => [name, process.env[name]]));
  try {
    for (const name of managedVariables) delete process.env[name];
    for (const [name, value] of Object.entries(values)) {
      if (value !== undefined) process.env[name] = value;
    }
    callback();
  } finally {
    for (const name of managedVariables) {
      const value = previous[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test("SENSORSPHERE_AGENT_ID is not required", () => {
  withEnvironment(
    {
      SENSORSPHERE_URL: "http://127.0.0.1:8080",
      SENSORSPHERE_AGENT_TOKEN: "ssma_test",
    },
    () => {
      const config = loadConfig();
      assert.equal(config.sensorSphereUrl, "http://127.0.0.1:8080");
      assert.equal(config.agentToken, "ssma_test");
      assert.equal("agentId" in config, false);
    },
  );
});
