import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsScreen } from "./Settings.js";
import { DEFAULT_SETTINGS } from "../settings.js";
import { renderInk, waitForInk } from "../test/ink.js";

const clearHistory = vi.fn();

vi.mock("../history.js", () => ({
  clearHistory: () => clearHistory(),
}));

const down = "\x1b[B";
const enter = "\r";
const escape = "\x1b";
const tab = "\t";
const up = "\x1b[A";

async function moveDown(app: ReturnType<typeof renderInk>, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await app.input(down);
  }
}

async function moveToSetting(
  app: ReturnType<typeof renderInk>,
  key: keyof typeof DEFAULT_SETTINGS
): Promise<void> {
  const settingIndex = Object.keys(DEFAULT_SETTINGS).indexOf(key);
  if (settingIndex === -1) {
    throw new Error(`Unknown setting: ${String(key)}`);
  }

  await moveDown(app, settingIndex);
}

describe("SettingsScreen", () => {
  beforeEach(() => {
    clearHistory.mockClear();
  });

  it("toggles settings and saves when changing tabs", async () => {
    const onSave = vi.fn();
    const onTab = vi.fn();
    const app = renderInk(
      <SettingsScreen
        settings={{ ...DEFAULT_SETTINGS, projectsDir: "/work" }}
        onSave={onSave}
        onClearHistory={vi.fn()}
        onTab={onTab}
        onClose={vi.fn()}
        tabBar={null}
      />
    );

    await moveToSetting(app, "showShortcuts");
    await app.input(enter);
    await app.input(tab);

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ showShortcuts: false }));
    expect(onTab).toHaveBeenCalledWith(false);
    app.cleanup();
  });

  it("clears history action and closes with escape", async () => {
    const onClearHistory = vi.fn();
    const onSave = vi.fn();
    const onClose = vi.fn();
    const app = renderInk(
      <SettingsScreen
        settings={DEFAULT_SETTINGS}
        onSave={onSave}
        onClearHistory={onClearHistory}
        onTab={vi.fn()}
        onClose={onClose}
        tabBar={null}
      />
    );

    await moveDown(app, Object.keys(DEFAULT_SETTINGS).length);
    await app.input(enter);
    await app.input(escape);

    expect(clearHistory).toHaveBeenCalledTimes(1);
    expect(onClearHistory).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    app.cleanup();
  });

  it("edits number and shortcut-key fields", async () => {
    const onSave = vi.fn();
    const app = renderInk(
      <SettingsScreen
        settings={DEFAULT_SETTINGS}
        onSave={onSave}
        onClearHistory={vi.fn()}
        onTab={vi.fn()}
        onClose={vi.fn()}
        tabBar={null}
      />
    );

    await moveToSetting(app, "maxDepth");
    await app.input(enter);
    await app.input(up);
    await app.input(enter);

    await moveDown(app, Object.keys(DEFAULT_SETTINGS).indexOf("shortcutToggleKey") - Object.keys(DEFAULT_SETTINGS).indexOf("maxDepth"));
    await app.input(enter);
    await app.input("x");
    await waitForInk();
    await app.input(escape);

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      maxDepth: 5,
      shortcutToggleKey: "x",
    }));
    app.cleanup();
  });
});
