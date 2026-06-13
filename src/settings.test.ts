import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

let home: string | null = null;

async function importSettings() {
  home = mkdtempSync(join(tmpdir(), "dash-settings-"));
  vi.resetModules();
  vi.doMock("node:os", async (importOriginal) => ({
    ...(await importOriginal<typeof import("node:os")>()),
    homedir: () => home,
  }));
  return import("./settings.js");
}

afterEach(() => {
  vi.doUnmock("node:os");
  vi.resetModules();
  if (home) {
    rmSync(home, { recursive: true, force: true });
    home = null;
  }
});

describe("settings", () => {
  it("loads defaults when no settings file exists", async () => {
    const { DEFAULT_SETTINGS, loadSettings, loadSettingsAsync } = await importSettings();

    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    await expect(loadSettingsAsync()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it("saves settings and merges missing fields with defaults", async () => {
    const { DEFAULT_SETTINGS, loadSettings, loadSettingsAsync, saveSettings } = await importSettings();
    const saved = { ...DEFAULT_SETTINGS, projectsDir: "/work", visibleRows: 8 };

    saveSettings(saved);

    expect(JSON.parse(readFileSync(join(home!, ".dash-cli", "settings.json"), "utf-8"))).toEqual(saved);
    expect(loadSettings()).toEqual(saved);
    await expect(loadSettingsAsync()).resolves.toEqual(saved);
  });

  it("falls back to defaults for invalid JSON", async () => {
    const { DEFAULT_SETTINGS, loadSettings, loadSettingsAsync } = await importSettings();
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(join(home!, ".dash-cli"), { recursive: true });
    writeFileSync(join(home!, ".dash-cli", "settings.json"), "{bad");

    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    await expect(loadSettingsAsync()).resolves.toEqual(DEFAULT_SETTINGS);
  });
});
