import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let home: string | null = null;
let logs: string[] = [];
let errors: string[] = [];

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
  errors = [];
  vi.spyOn(console, "log").mockImplementation((message = "") => {
    logs.push(String(message));
  });
  vi.spyOn(console, "error").mockImplementation((message = "") => {
    errors.push(String(message));
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

  it("reports command usage and not-found errors", async () => {
    const { dispatch } = await importCli();
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit");
    }) as never);

    await expect(dispatch(["unknown"])).rejects.toThrow("exit");
    expect(errors.at(-1)).toContain("Unknown command: unknown");

    await expect(dispatch(["add"])).rejects.toThrow("exit");
    expect(errors.at(-1)).toContain("Usage: dash -- add");

    await expect(dispatch(["show", "missing"])).rejects.toThrow("exit");
    expect(errors.at(-1)).toContain("Shortcut not found: missing");

    await expect(dispatch(["rm", "missing", "--json"])).rejects.toThrow("exit");
    expect(JSON.parse(logs.at(-1)!)).toEqual({ error: "Shortcut not found: missing" });
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("reports edit validation and collision errors", async () => {
    const { dispatch } = await importCli();
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit");
    }) as never);

    await dispatch(["add", "proj", "cd /work/proj"]);
    await dispatch(["add", "api", "cd /work/api"]);

    await expect(dispatch(["add", "PROJ", "echo duplicate"])).rejects.toThrow("exit");
    expect(errors.at(-1)).toContain("collides");

    await expect(dispatch(["edit", "proj"])).rejects.toThrow("exit");
    expect(errors.at(-1)).toContain("No updates provided");

    await expect(dispatch(["edit", "proj", "--trigger", "api"])).rejects.toThrow("exit");
    expect(errors.at(-1)).toContain("collides");

    expect(exit).toHaveBeenCalledWith(1);
  });
});
