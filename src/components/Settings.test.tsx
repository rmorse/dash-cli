import React from "react";
import { describe, expect, it, vi } from "vitest";
import { SettingsScreen } from "./Settings.js";
import { DEFAULT_SETTINGS } from "../settings.js";
import { renderInk, waitForInk } from "../test/ink.js";

describe("SettingsScreen", () => {
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

    await app.input("\x1b[B");
    await app.input("\x1b[B");
    await app.input("\x1b[B");
    await app.input("\r");
    await app.input("\t");

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

    for (let i = 0; i < 13; i++) {
      await app.input("\x1b[B");
    }
    await app.input("\r");
    await app.input("\x1b");

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

    await app.input("\x1b[B");
    await app.input("\r");
    await app.input("\x1b[A");
    await app.input("\r");

    for (let i = 0; i < 9; i++) {
      await app.input("\x1b[B");
    }
    await app.input("\r");
    await app.input("x");
    await waitForInk();
    await app.input("\x1b");

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      maxDepth: 5,
      shortcutToggleKey: "x",
    }));
    app.cleanup();
  });
});
