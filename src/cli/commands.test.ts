import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let home: string | null = null;
let logs: string[] = [];

async function importCli() {
  home = mkdtempSync(join(tmpdir(), "dash-cli-commands-"));
  vi.resetModules();
  vi.doMock("node:os", async (importOriginal) => ({
    ...(await importOriginal<typeof import("node:os")>()),
    homedir: () => home,
  }));
  return import("./index.js");
}

beforeEach(() => {
  logs = [];
  vi.spyOn(console, "log").mockImplementation((message = "") => {
    logs.push(String(message));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("node:os");
  vi.resetModules();
  if (home) {
    rmSync(home, { recursive: true, force: true });
    home = null;
  }
});

describe("CLI shortcut commands", () => {
  it("adds, lists, shows, edits, and removes shortcuts", async () => {
    const { dispatch } = await importCli();

    await dispatch(["add", "proj", "cd /work/proj", "code .", "--name", "Project", "--json"]);
    expect(JSON.parse(logs.at(-1)!)).toMatchObject({
      success: true,
      shortcut: { trigger: "proj", name: "Project", command: ["cd /work/proj", "code ."] },
    });

    await dispatch(["list", "--json"]);
    expect(JSON.parse(logs.at(-1)!)).toMatchObject({
      shortcuts: [{ trigger: "proj", name: "Project" }],
    });

    await dispatch(["show", "PROJ", "--json"]);
    expect(JSON.parse(logs.at(-1)!)).toMatchObject({
      shortcut: { trigger: "proj", caseSensitive: false },
    });

    await dispatch(["edit", "proj", "--trigger", "app", "--command", "cd /work/app,npm test", "--case-sensitive", "--json"]);
    expect(JSON.parse(logs.at(-1)!)).toMatchObject({
      success: true,
      shortcut: { trigger: "app", caseSensitive: true, command: ["cd /work/app", "npm test"] },
    });

    await dispatch(["rm", "app", "--json"]);
    expect(JSON.parse(logs.at(-1)!)).toEqual({ deleted: true, trigger: "app" });
  });

  it("shows help for missing or help commands", async () => {
    const { dispatch } = await importCli();

    await dispatch([]);
    await dispatch(["help"]);

    expect(logs.join("\n")).toContain("Usage: dash -- <command>");
    expect(logs.join("\n")).toContain("Commands:");
  });

  it("formats human-readable list output", async () => {
    const { dispatch } = await importCli();

    await dispatch(["add", "proj", "cd /work/proj"]);
    await dispatch(["list"]);

    expect(logs.join("\n")).toContain("Shortcuts:");
    expect(logs.join("\n")).toContain("proj");
  });
});
