import React from "react";
import { describe, expect, it, vi } from "vitest";
import { ShortcutsEditor } from "./ShortcutsEditor.js";
import { DEFAULT_SETTINGS } from "../settings.js";
import type { Shortcut } from "../types.js";
import { renderInk } from "../test/ink.js";

vi.mock("../shortcuts.js", () => ({
  removeShortcut: vi.fn(),
  clearShortcuts: vi.fn(),
  moveShortcut: vi.fn((_id: string, targetIndex: number) => {
    const shortcuts = sampleShortcuts();
    const [moved] = shortcuts.splice(0, 1);
    shortcuts.splice(targetIndex, 0, moved);
    return shortcuts;
  }),
}));

const sampleShortcuts = (): Shortcut[] => [
  {
    id: "one",
    name: "One",
    trigger: "1",
    caseSensitive: false,
    command: ["cd /one"],
    pinned: true,
    order: 0,
    createdAt: 1,
  },
  {
    id: "two",
    name: "Two",
    trigger: "2",
    caseSensitive: false,
    command: ["cd /two"],
    pinned: true,
    order: 1,
    createdAt: 2,
  },
];

describe("ShortcutsEditor", () => {
  it("opens the selected shortcut and adds a new one", async () => {
    const onEditShortcut = vi.fn();
    const onAddShortcut = vi.fn();
    const app = renderInk(
      <ShortcutsEditor
        shortcuts={sampleShortcuts()}
        onUpdate={vi.fn()}
        onEditShortcut={onEditShortcut}
        onAddShortcut={onAddShortcut}
        onTab={vi.fn()}
        onClose={vi.fn()}
        selectedColor="yellow"
        tabBar={null}
        settings={DEFAULT_SETTINGS}
      />
    );

    await app.input("\r");
    await app.input("\x1b[B");
    await app.input("\x1b[B");
    await app.input("\r");

    expect(onEditShortcut).toHaveBeenCalledWith("one");
    expect(onAddShortcut).toHaveBeenCalledTimes(1);
    app.cleanup();
  });

  it("confirms deletion and supports move mode", async () => {
    const onUpdate = vi.fn();
    const app = renderInk(
      <ShortcutsEditor
        shortcuts={sampleShortcuts()}
        onUpdate={onUpdate}
        onEditShortcut={vi.fn()}
        onAddShortcut={vi.fn()}
        onTab={vi.fn()}
        onClose={vi.fn()}
        selectedColor="yellow"
        tabBar={null}
        settings={DEFAULT_SETTINGS}
      />
    );

    await app.input("\x0f");
    await app.input("\x1b[B");
    await app.input("\r");
    expect(onUpdate).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: "one" })]));

    await app.input("\x04");
    await app.input("y");
    expect(onUpdate).toHaveBeenCalledWith([expect.objectContaining({ id: "one" })]);
    app.cleanup();
  });

  it("clears all shortcuts and supports tab or escape navigation", async () => {
    const onUpdate = vi.fn();
    const onTab = vi.fn();
    const onClose = vi.fn();
    const app = renderInk(
      <ShortcutsEditor
        shortcuts={sampleShortcuts()}
        onUpdate={onUpdate}
        onEditShortcut={vi.fn()}
        onAddShortcut={vi.fn()}
        onTab={onTab}
        onClose={onClose}
        selectedColor="yellow"
        tabBar={null}
        settings={DEFAULT_SETTINGS}
      />
    );

    await app.input("\x1b[B");
    await app.input("\x1b[B");
    await app.input("\x1b[B");
    await app.input("\r");
    await app.input("y");
    expect(onUpdate).toHaveBeenCalledWith([]);

    await app.input("\t");
    await app.input("\x1b");
    expect(onTab).toHaveBeenCalledWith(false);
    expect(onClose).toHaveBeenCalledTimes(1);
    app.cleanup();
  });
});
