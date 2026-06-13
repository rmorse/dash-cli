import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";
import { DEFAULT_SETTINGS } from "../settings.js";
import type { HistoryEntry, Project, Shortcut } from "../types.js";
import { renderInk, waitForInk, waitForOutput } from "../test/ink.js";

const mocks = vi.hoisted(() => ({
  scanProjectsAsync: vi.fn(),
  loadCacheAsync: vi.fn(),
  saveCache: vi.fn(),
  addShortcut: vi.fn(),
  removeShortcut: vi.fn(),
  findShortcutByPath: vi.fn(),
  generateCommand: vi.fn((path: string) => [`cd "${path}"`]),
  generateUniqueTrigger: vi.fn(() => "3"),
  updateShortcut: vi.fn(),
  validateTrigger: vi.fn(() => ({ valid: true })),
  writeLastCommand: vi.fn(),
}));

vi.mock("../scanner.js", () => ({
  scanProjectsAsync: mocks.scanProjectsAsync,
}));

vi.mock("../cache.js", () => ({
  loadCacheAsync: mocks.loadCacheAsync,
  saveCache: mocks.saveCache,
}));

vi.mock("../shortcuts.js", () => ({
  addShortcut: mocks.addShortcut,
  removeShortcut: mocks.removeShortcut,
  findShortcutByPath: mocks.findShortcutByPath,
  generateCommand: mocks.generateCommand,
  generateUniqueTrigger: mocks.generateUniqueTrigger,
  updateShortcut: mocks.updateShortcut,
  validateTrigger: mocks.validateTrigger,
}));

vi.mock("../history.js", () => ({
  writeLastCommand: mocks.writeLastCommand,
}));

const settings = {
  ...DEFAULT_SETTINGS,
  projectsDir: "/work",
};

const projects: Project[] = [
  { name: "alpha", path: "/work/alpha", isGitRepo: true },
  {
    name: "group",
    path: "/work/group",
    isGitRepo: false,
    hasNestedProjects: true,
    nestedProjects: [
      { name: "child", path: "/work/group/child", isGitRepo: true },
    ],
  },
];

const shortcut: Shortcut = {
  id: "shortcut-1",
  name: "Alpha shortcut",
  trigger: "a",
  caseSensitive: false,
  command: ['cd "/work/alpha"', "npm test"],
  pinned: true,
  order: 0,
  createdAt: 1,
};

const recent: HistoryEntry = {
  path: "/work/group/child",
  displayName: "group/child",
  lastUsed: 1,
};

function renderApp(overrides: Partial<React.ComponentProps<typeof App>> = {}) {
  const props: React.ComponentProps<typeof App> = {
    initialSettings: settings,
    recentEntries: [recent],
    shortcutEntries: [shortcut],
    onSelect: vi.fn(),
    onSettingsSave: vi.fn(),
    ...overrides,
  };

  return {
    props,
    app: renderInk(<App {...props} />),
  };
}

describe("App", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders cached projects while refreshing and executes selected shortcuts", async () => {
    mocks.loadCacheAsync.mockResolvedValue(projects);
    mocks.scanProjectsAsync.mockResolvedValue(projects);

    const { app } = renderApp();

    await waitForOutput(app, "Alpha shortcut");
    await app.input("\r");

    expect(mocks.writeLastCommand).toHaveBeenCalledWith(shortcut.command);
    expect(mocks.saveCache).toHaveBeenCalledWith(projects, "/work", settings.maxDepth, settings.skipDirs);
    app.cleanup();
  });

  it("selects projects, searches, and refreshes the project list", async () => {
    mocks.loadCacheAsync.mockResolvedValue(null);
    mocks.scanProjectsAsync.mockResolvedValue(projects);
    const onSelect = vi.fn();

    const { app } = renderApp({
      shortcutEntries: [],
      recentEntries: [],
      onSelect,
    });

    await waitForOutput(app, "alpha");
    await app.input("alp");
    await waitForOutput(app, "alp");
    await app.input("\r");

    expect(onSelect).toHaveBeenCalledWith("/work/alpha", "alpha");

    await app.input("\x12");
    expect(mocks.scanProjectsAsync).toHaveBeenCalledTimes(2);
    app.cleanup();
  });

  it("drills into nested projects and returns to the root list", async () => {
    mocks.loadCacheAsync.mockResolvedValue(projects);
    mocks.scanProjectsAsync.mockResolvedValue(projects);

    const { app } = renderApp({
      shortcutEntries: [],
      recentEntries: [],
    });

    await waitForOutput(app, "group");
    await app.input("\x1b[B");
    await app.input("\x1b[C");
    await waitForOutput(app, "child");

    expect(app.output()).toContain("Back");

    await app.input("\x1b[D");
    await waitForOutput(app, "All Projects");
    app.cleanup();
  });

  it("adds a shortcut from the projects list", async () => {
    const newShortcut = {
      ...shortcut,
      id: "new-shortcut",
      name: "alpha",
      trigger: "3",
      command: ['cd "/work/alpha"'],
    };
    mocks.loadCacheAsync.mockResolvedValue(projects);
    mocks.scanProjectsAsync.mockResolvedValue(projects);
    mocks.findShortcutByPath.mockReturnValue(undefined);
    mocks.addShortcut.mockReturnValue(newShortcut);

    const { app } = renderApp({
      shortcutEntries: [],
      recentEntries: [],
    });

    await waitForOutput(app, "alpha");
    await app.input("\x14");
    await waitForInk();

    expect(mocks.addShortcut).toHaveBeenCalledWith({
      name: "alpha",
      trigger: "3",
      caseSensitive: false,
      command: ['cd "/work/alpha"'],
    });
    app.cleanup();
  });

  it("opens the shortcuts tab and edits a shortcut", async () => {
    mocks.loadCacheAsync.mockResolvedValue(projects);
    mocks.scanProjectsAsync.mockResolvedValue(projects);
    mocks.updateShortcut.mockReturnValue({ ...shortcut, name: "Alpha shortcut" });

    const { app } = renderApp();

    await waitForOutput(app, "Alpha shortcut");
    await app.input("\t");
    await waitForOutput(app, "Shortcuts");
    await app.input("\r");
    await waitForOutput(app, "Edit Shortcut");
    await app.input("\x1b");

    expect(mocks.updateShortcut).toHaveBeenCalledWith(shortcut.id, expect.objectContaining({
      name: shortcut.name,
      trigger: shortcut.trigger,
      command: shortcut.command,
    }));
    app.cleanup();
  });

  it("opens settings through tab navigation and saves on close", async () => {
    mocks.loadCacheAsync.mockResolvedValue(projects);
    mocks.scanProjectsAsync.mockResolvedValue(projects);
    const onSettingsSave = vi.fn();

    const { app } = renderApp({ onSettingsSave });

    await waitForOutput(app, "Alpha shortcut");
    await app.input("\t");
    await app.input("\t");
    await waitForOutput(app, "Projects Directory");
    await app.input("\x1b");

    expect(onSettingsSave).toHaveBeenCalledWith(expect.objectContaining({
      projectsDir: "/work",
    }));
    app.cleanup();
  });

  it("deletes shortcuts from the projects shortcut section after confirmation", async () => {
    mocks.loadCacheAsync.mockResolvedValue(projects);
    mocks.scanProjectsAsync.mockResolvedValue(projects);
    mocks.removeShortcut.mockReturnValue(true);

    const { app } = renderApp();

    await waitForOutput(app, "Alpha shortcut");
    await app.input("\x04");
    await waitForOutput(app, "Delete? (y/n)");
    await app.input("y");

    expect(mocks.removeShortcut).toHaveBeenCalledWith(shortcut.id);
    app.cleanup();
  });
});
