import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

let home: string | null = null;

async function importShortcuts() {
  home = mkdtempSync(join(tmpdir(), "dash-shortcuts-"));
  vi.resetModules();
  vi.doMock("node:os", async (importOriginal) => ({
    ...(await importOriginal<typeof import("node:os")>()),
    homedir: () => home,
  }));
  return import("./shortcuts.js");
}

afterEach(() => {
  vi.doUnmock("node:os");
  vi.resetModules();
  if (home) {
    rmSync(home, { recursive: true, force: true });
    home = null;
  }
});

describe("shortcuts", () => {
  it("validates triggers and commands", async () => {
    const shortcuts = await importShortcuts();

    expect(shortcuts.validateTriggerFormat("")).toEqual({ valid: false, error: "Trigger cannot be empty" });
    expect(shortcuts.validateTriggerFormat("bad trigger")).toEqual({ valid: false, error: "Trigger cannot contain spaces" });
    expect(shortcuts.validateTriggerFormat("--flag")).toEqual({ valid: false, error: "Trigger cannot start with '--'" });
    expect(shortcuts.validateCommand([]).valid).toBe(false);
    expect(shortcuts.validateCommand(["", "npm test"]).valid).toBe(true);
  });

  it("adds, finds, updates, moves, and removes shortcuts", async () => {
    const shortcuts = await importShortcuts();

    const one = shortcuts.addShortcut({
      name: "One",
      trigger: "one",
      caseSensitive: false,
      command: shortcuts.generateCommand('/work/"one"'),
    });
    const two = shortcuts.addShortcut({
      name: "Two",
      trigger: "Two",
      caseSensitive: true,
      command: ["cd /work/two", "code ."],
      pinned: false,
    });

    expect(one.command).toEqual(['cd "/work/\\"one\\""']);
    expect(shortcuts.getShortcutByTrigger("ONE")?.id).toBe(one.id);
    expect(shortcuts.getShortcutByTrigger("two")).toBeUndefined();
    await expect(shortcuts.getShortcutByTriggerAsync("Two")).resolves.toMatchObject({ id: two.id });
    expect(shortcuts.getShortcuts().map((shortcut) => shortcut.trigger)).toEqual(["one", "Two"]);

    const updated = shortcuts.updateShortcut(two.id, {
      name: "Second",
      trigger: "second",
      caseSensitive: false,
      command: ["cd /work/two"],
      pinned: true,
    });
    expect(updated).toMatchObject({ name: "Second", trigger: "second", pinned: true });

    expect(() => shortcuts.updateShortcut("missing", { name: "Nope" })).toThrow('Shortcut with ID "missing" not found');
    expect(() => shortcuts.addShortcut({
      name: "Duplicate",
      trigger: "SECOND",
      caseSensitive: false,
      command: ["echo duplicate"],
    })).toThrow(/collides/);

    expect(shortcuts.moveShortcut(updated.id, 0).map((shortcut) => shortcut.id)).toEqual([updated.id, one.id]);
    expect(shortcuts.removeShortcut(one.id)).toBe(true);
    expect(shortcuts.removeShortcut("missing")).toBe(false);
    expect(shortcuts.getShortcuts().map((shortcut) => shortcut.trigger)).toEqual(["second"]);
  });

  it("generates numeric triggers and finds exact path shortcuts", async () => {
    const shortcuts = await importShortcuts();
    const existing = [
      shortcuts.addShortcut({
        name: "One",
        trigger: "1",
        caseSensitive: false,
        command: shortcuts.generateCommand("/work/one"),
      }),
      shortcuts.addShortcut({
        name: "Two",
        trigger: "2",
        caseSensitive: false,
        command: shortcuts.generateCommand("/work/two"),
      }),
    ];

    expect(shortcuts.generateUniqueTrigger(existing)).toBe("3");
    expect(shortcuts.findShortcutByPath("/work/two")?.trigger).toBe("2");
    shortcuts.clearShortcuts();
    expect(shortcuts.getShortcuts()).toEqual([]);
  });
});
