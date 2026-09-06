import assert from "node:assert/strict";
import test from "node:test";
import { PingExecutor } from "../checks/ping.js";

test("PingExecutor supports only PING", () => {
  const executor = new PingExecutor();
  assert.equal(executor.supports("PING"), true);
  assert.equal(executor.supports("ping"), true);
  assert.equal(executor.supports("TCP"), false);
});
