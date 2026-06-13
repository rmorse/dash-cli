import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShortcutEdit } from "./ShortcutEdit.js";
import type { Shortcut } from "../types.js";
import { renderInk } from "../test/ink.js";

const updateShortcut = vi.fn((id: string, updates: Partial<Shortcut>) => ({
  ...shortcut,
  ...updates,
  id,
}));
const validateTrigger = vi.fn(() => ({ valid: true }));

vi.mock("../shortcuts.js", () => ({
  updateShortcut: (...args: Parameters<typeof updateShortcut>) => updateShortcut(...args),
  validateTrigger: (...args: Parameters<typeof validateTrigger>) => validateTrigger(...args),
}));

const shortcut: Shortcut = {
  id: "one",
  name: "One",
  trigger: "1",
  caseSensitive: false,
  command: ["cd /one"],
  pinned: true,
  order: 0,
  createdAt: 1,
};

describe("ShortcutEdit", () => {
  beforeEach(() => {
    updateShortcut.mockClear();
    validateTrigger.mockClear();
    validateTrigger.mockReturnValue({ valid: true });
  });

  it("toggles fields and saves on escape", async () => {
    const onSave = vi.fn();
    const onBack = vi.fn();
    const app = renderInk(
      <ShortcutEdit
        shortcut={shortcut}
        allShortcuts={[shortcut]}
        onSave={onSave}
        onBack={onBack}
        onTab={vi.fn()}
        selectedColor="yellow"
        tabBar={null}
      />
    );

    await app.input("\x1b[B");
    await app.input("\x1b[B");
    await app.input("\r");
    await app.input("\x1b[B");
    await app.input("\r");
    await app.input("\x1b");

    expect(updateShortcut).toHaveBeenCalledWith("one", expect.objectContaining({
      caseSensitive: true,
      pinned: false,
      command: ["cd /one"],
    }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ caseSensitive: true, pinned: false }));
    expect(onBack).toHaveBeenCalledTimes(1);
    app.cleanup();
  });

  it("prevents deleting the only command line", async () => {
    const app = renderInk(
      <ShortcutEdit
        shortcut={shortcut}
        allShortcuts={[shortcut]}
        onSave={vi.fn()}
        onBack={vi.fn()}
        onTab={vi.fn()}
        selectedColor="yellow"
        tabBar={null}
      />
    );

    for (let i = 0; i < 4; i++) {
      await app.input("\x1b[B");
    }
    await app.input("\x04");

    expect(app.output()).toContain("Cannot delete - at least one command required");
    app.cleanup();
  });

  it("adds and edits command lines before saving through tab", async () => {
    const onTab = vi.fn();
    const app = renderInk(
      <ShortcutEdit
        shortcut={shortcut}
        allShortcuts={[shortcut]}
        onSave={vi.fn()}
        onBack={vi.fn()}
        onTab={onTab}
        selectedColor="yellow"
        tabBar={null}
      />
    );

    for (let i = 0; i < 5; i++) {
      await app.input("\x1b[B");
    }
    await app.input("\r");
    await app.input("npm test");
    await app.input("\r");
    await app.input("\t");

    expect(updateShortcut).toHaveBeenCalledWith("one", expect.objectContaining({
      command: ["cd /one", "npm test"],
    }));
    expect(onTab).toHaveBeenCalledWith(false);
    app.cleanup();
  });

  it("shows validation errors instead of saving invalid shortcuts", async () => {
    validateTrigger.mockReturnValueOnce({ valid: false, error: "bad trigger" });
    const app = renderInk(
      <ShortcutEdit
        shortcut={shortcut}
        allShortcuts={[shortcut]}
        onSave={vi.fn()}
        onBack={vi.fn()}
        onTab={vi.fn()}
        selectedColor="yellow"
        tabBar={null}
      />
    );

    await app.input("\x1b");

    expect(updateShortcut).not.toHaveBeenCalled();
    expect(app.output()).toContain("bad trigger");
    app.cleanup();
  });
});
