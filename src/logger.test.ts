import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

let home: string | null = null;

async function importLogger() {
  home = mkdtempSync(join(tmpdir(), "dash-logger-"));
  vi.resetModules();
  vi.doMock("node:os", async (importOriginal) => ({
    ...(await importOriginal<typeof import("node:os")>()),
    homedir: () => home,
  }));
  return import("./logger.js");
}

afterEach(() => {
  vi.doUnmock("node:os");
  vi.resetModules();
  if (home) {
    rmSync(home, { recursive: true, force: true });
    home = null;
  }
});

describe("logger", () => {
  it("does not write when debug logging is disabled", async () => {
    const logger = await importLogger();

    logger.initLog(false);
    logger.log("hidden");

    expect(existsSync(join(home!, ".dash-cli", "debug.log"))).toBe(false);
  });

  it("starts a fresh log and appends elapsed messages when enabled", async () => {
    const logger = await importLogger();

    logger.initLog(true);
    logger.log("hello");

    const content = readFileSync(join(home!, ".dash-cli", "debug.log"), "utf-8");
    expect(content).toContain("=== Debug log started at");
    expect(content).toContain("hello");
    expect(content).toMatch(/\[\+\s*\d+ms\]/);
  });
});
