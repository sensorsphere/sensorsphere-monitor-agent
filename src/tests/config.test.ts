import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../config/env.js";

const managedVariables = [
  "SENSORSPHERE_URL",
  "SENSORSPHERE_AGENT_ID",
  "SENSORSPHERE_AGENT_TOKEN",
  "AGENT_LABELS",
  "AGENT_NAME",
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
      assert.deepEqual(config.agentLabels, []);
    },
  );
});


test("AGENT_LABELS is parsed, trimmed and deduplicated", () => {
  withEnvironment(
    {
      SENSORSPHERE_URL: "http://127.0.0.1:8080",
      SENSORSPHERE_AGENT_TOKEN: "ssma_test",
      AGENT_LABELS: "vm-022, site-paris,oracle,site-paris, ,vm-022",
    },
    () => {
      const config = loadConfig();
      assert.deepEqual(config.agentLabels, ["vm-022", "site-paris", "oracle"]);
    },
  );
});


test("AGENT_NAME is trimmed and optional", () => {
  withEnvironment(
    {
      SENSORSPHERE_URL: "http://example.test",
      SENSORSPHERE_AGENT_TOKEN: "ssma_test",
      AGENT_NAME: "  monitor-home  ",
    },
    () => {
      assert.equal(loadConfig().agentName, "monitor-home");
    },
  );

  withEnvironment(
    {
      SENSORSPHERE_URL: "http://example.test",
      SENSORSPHERE_AGENT_TOKEN: "ssma_test",
    },
    () => {
      assert.equal(loadConfig().agentName, undefined);
    },
  );
});
