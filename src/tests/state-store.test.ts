import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { StateStore } from "../persistence/state-store.js";
import { Logger } from "../util/logger.js";

const logger = new Logger("error");

test("StateStore starts empty when neither primary nor backup exists", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ssma-state-"));
  const store = new StateStore(path.join(dir, "state.json"), 10, 60_000, logger);
  const state = await store.load();
  assert.equal(state.configRevision, null);
  assert.deepEqual(state.checks, []);
  assert.deepEqual(state.queuedResults, []);
});

test("StateStore refuses invalid primary when no valid backup exists", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ssma-state-bad-"));
  const file = path.join(dir, "state.json");
  await fs.writeFile(file, "not-json");
  const store = new StateStore(file, 10, 60_000, logger);
  await assert.rejects(() => store.load(), /Refusing to replace invalid monitoring state/);
});
