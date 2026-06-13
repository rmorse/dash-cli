import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  render: vi.fn(),
  dispatch: vi.fn(),
  runSetup: vi.fn(),
  runUninstall: vi.fn(),
  getRecentAsync: vi.fn(),
  addRecent: vi.fn(),
  writeLastCommand: vi.fn(),
  getShortcutsAsync: vi.fn(),
  getShortcutByTriggerAsync: vi.fn(),
  generateCommand: vi.fn((path: string) => [`cd "${path}"`]),
  loadSettingsAsync: vi.fn(),
  saveSettings: vi.fn(),
  initLog: vi.fn(),
  log: vi.fn(),
}));

vi.mock("ink", () => ({
  render: mocks.render,
}));

vi.mock("./components/App.js", () => ({
  App: (props: Record<string, unknown>) => React.createElement("app", props),
}));

vi.mock("./history.js", () => ({
  getRecentAsync: mocks.getRecentAsync,
  addRecent: mocks.addRecent,
  writeLastCommand: mocks.writeLastCommand,
}));

vi.mock("./shortcuts.js", () => ({
  getShortcutsAsync: mocks.getShortcutsAsync,
  getShortcutByTriggerAsync: mocks.getShortcutByTriggerAsync,
  generateCommand: mocks.generateCommand,
}));

vi.mock("./settings.js", () => ({
  loadSettingsAsync: mocks.loadSettingsAsync,
  saveSettings: mocks.saveSettings,
}));

vi.mock("./setup.js", () => ({
  runSetup: mocks.runSetup,
  runUninstall: mocks.runUninstall,
}));

vi.mock("./logger.js", () => ({
  initLog: mocks.initLog,
  log: mocks.log,
}));

vi.mock("./cli/index.js", () => ({
  dispatch: mocks.dispatch,
}));

async function importIndex(args: string[]) {
  vi.resetModules();
  process.argv = ["node", "dist/index.js", ...args];
  await import("./index.js");
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("index entrypoint", () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadSettingsAsync.mockResolvedValue({
      projectsDir: "/work",
      recentCount: 5,
    });
    mocks.getRecentAsync.mockResolvedValue([]);
    mocks.getShortcutsAsync.mockResolvedValue([]);
    mocks.render.mockReturnValue({
      waitUntilExit: vi.fn().mockResolvedValue(undefined),
      unmount: vi.fn(),
    });
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  it("dispatches CLI mode after the separator", async () => {
    await importIndex(["--debug", "--", "list", "--json"]);

    expect(mocks.initLog).toHaveBeenCalledWith(true);
    expect(mocks.dispatch).toHaveBeenCalledWith(["list", "--json"]);
  });

  it("routes setup and uninstall commands", async () => {
    await importIndex(["--setup", "bash", "--alias"]);
    expect(mocks.runSetup).toHaveBeenCalledWith("bash", "--alias");

    await importIndex(["--uninstall", "powershell"]);
    expect(mocks.runUninstall).toHaveBeenCalledWith("powershell");
  });

  it("writes chained shortcut commands for trigger args", async () => {
    mocks.getShortcutByTriggerAsync
      .mockResolvedValueOnce({ name: "Project", command: ["cd /work/project"] })
      .mockResolvedValueOnce({ name: "Test", command: ["npm test"] });

    await importIndex(["proj", "test"]);

    expect(mocks.writeLastCommand).toHaveBeenCalledWith(["cd /work/project", "npm test"]);
  });

  it("records selected projects from the TUI", async () => {
    mocks.render.mockImplementation((node: React.ReactElement<{ onSelect: (path: string, name: string) => void }>) => {
      const unmount = vi.fn();
      return {
        unmount,
        waitUntilExit: vi.fn().mockImplementation(async () => {
          node.props.onSelect("/work/app", "app");
        }),
      };
    });

    await importIndex([]);

    expect(mocks.addRecent).toHaveBeenCalledWith("/work/app", "app");
    expect(mocks.writeLastCommand).toHaveBeenCalledWith(['cd "/work/app"']);
  });
});
