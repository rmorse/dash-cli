import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Project } from "./types.js";

let home: string | null = null;

async function importCache() {
  home = mkdtempSync(join(tmpdir(), "dash-cache-"));
  vi.resetModules();
  vi.doMock("node:os", async (importOriginal) => ({
    ...(await importOriginal<typeof import("node:os")>()),
    homedir: () => home,
  }));
  return import("./cache.js");
}

afterEach(() => {
  vi.doUnmock("node:os");
  vi.resetModules();
  if (home) {
    rmSync(home, { recursive: true, force: true });
    home = null;
  }
});

describe("cache", () => {
  const projects: Project[] = [
    { name: "app", path: "/work/app", isGitRepo: true },
  ];

  it("returns null when cache is missing", async () => {
    const cache = await importCache();

    expect(cache.loadCache("/work", 4, "node_modules")).toBeNull();
    await expect(cache.loadCacheAsync("/work", 4, "node_modules")).resolves.toBeNull();
  });

  it("saves and loads cache entries for matching settings", async () => {
    const cache = await importCache();
    mkdirSync(join(home!, ".dash-cli"), { recursive: true });

    cache.saveCache(projects, "/work", 4, "node_modules");

    expect(cache.loadCache("/work", 4, "node_modules")).toEqual(projects);
    await expect(cache.loadCacheAsync("/work", 4, "node_modules")).resolves.toEqual(projects);
  });

  it("rejects cache entries for different settings", async () => {
    const cache = await importCache();
    mkdirSync(join(home!, ".dash-cli"), { recursive: true });

    cache.saveCache(projects, "/work", 4, "node_modules");

    expect(cache.loadCache("/other", 4, "node_modules")).toBeNull();
    expect(cache.loadCache("/work", 5, "node_modules")).toBeNull();
    await expect(cache.loadCacheAsync("/work", 4, "dist")).resolves.toBeNull();
  });

  it("returns null for invalid cache JSON", async () => {
    const cache = await importCache();
    const configDir = join(home!, ".dash-cli");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "cache.json"), "{not-json");

    expect(cache.loadCache("/work", 4, "node_modules")).toBeNull();
    await expect(cache.loadCacheAsync("/work", 4, "node_modules")).resolves.toBeNull();
  });

  it("clears existing cache data", async () => {
    const cache = await importCache();
    const configDir = join(home!, ".dash-cli");
    mkdirSync(configDir, { recursive: true });
    cache.saveCache(projects, "/work", 4, "node_modules");

    cache.clearCache();

    expect(readFileSync(join(configDir, "cache.json"), "utf-8")).toBe("{}");
    expect(cache.loadCache("/work", 4, "node_modules")).toBeNull();
  });
});
