import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let home: string;
let answers: string[];
const close = vi.fn();

async function importSetup() {
  vi.resetModules();
  vi.doMock("node:os", async (importOriginal) => ({
    ...(await importOriginal<typeof import("node:os")>()),
    homedir: () => home,
  }));
  vi.doMock("node:readline", () => ({
    createInterface: () => ({
      question: (_prompt: string, callback: (answer: string) => void) => {
        callback(answers.shift() ?? "");
      },
      close,
    }),
  }));
  return import("./setup.js");
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "dash-setup-"));
  answers = [];
  close.mockClear();
  process.env.DASH_CLI_DOCUMENTS_DIR = join(home, "Documents");
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("node:os");
  vi.doUnmock("node:readline");
  vi.resetModules();
  delete process.env.DASH_CLI_DOCUMENTS_DIR;
  rmSync(home, { recursive: true, force: true });
});

describe("setup", () => {
  it("sets up and uninstalls Bash integration with an alias", async () => {
    const projectsDir = join(home, "projects");
    const { mkdirSync } = await import("node:fs");
    mkdirSync(projectsDir);
    answers = [projectsDir];
    const { runSetup, runUninstall } = await importSetup();

    await runSetup("bash", "--alias");

    const bashrc = join(home, ".bashrc");
    expect(readFileSync(bashrc, "utf-8")).toContain("dash-cli");
    expect(readFileSync(bashrc, "utf-8")).toContain("alias d=dash");
    expect(JSON.parse(readFileSync(join(home, ".dash-cli", "settings.json"), "utf-8"))).toMatchObject({
      projectsDir,
    });
    expect(close).toHaveBeenCalledTimes(1);

    await runUninstall("bash");

    expect(readFileSync(bashrc, "utf-8")).not.toContain("# Dash CLI:");
    expect(existsSync(`${bashrc}.bkp`)).toBe(true);
  });

  it("sets up and uninstalls PowerShell integration", async () => {
    const projectsDir = join(home, "projects");
    const { mkdirSync } = await import("node:fs");
    mkdirSync(projectsDir);
    answers = [projectsDir, "n"];
    const { runSetup, runUninstall } = await importSetup();

    await runSetup("powershell");

    const profilePath = process.platform === "win32"
      ? join(home, "Documents", "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1")
      : join(home, ".config", "powershell", "Microsoft.PowerShell_profile.ps1");
    const profile = readFileSync(profilePath, "utf-8");
    expect(profile).toContain("function dash");
    expect(profile).not.toContain("Set-Alias -Name d -Value dash");

    await runUninstall("powershell");

    expect(readFileSync(profilePath, "utf-8")).not.toContain("# Dash CLI:");
  });

  it("rejects unknown shells", async () => {
    const { runUninstall } = await importSetup();
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit");
    }) as never);

    await expect(runUninstall("fish")).rejects.toThrow("exit");
    expect(exit).toHaveBeenCalledWith(1);
  });
});
