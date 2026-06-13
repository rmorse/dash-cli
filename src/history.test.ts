import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

let home: string | null = null;

async function importHistory() {
  home = mkdtempSync(join(tmpdir(), "dash-history-"));
  vi.resetModules();
  vi.doMock("node:os", async (importOriginal) => ({
    ...(await importOriginal<typeof import("node:os")>()),
    homedir: () => home,
  }));
  return import("./history.js");
}

afterEach(() => {
  vi.doUnmock("node:os");
  vi.resetModules();
  if (home) {
    rmSync(home, { recursive: true, force: true });
    home = null;
  }
});

describe("history", () => {
  it("tracks recent entries by most recent use", async () => {
    const history = await importHistory();

    history.addRecent("/work/one", "one");
    history.addRecent("/work/two", "two");
    history.addRecent("/work/one", "one again");

    expect(history.getRecent(2).map((entry) => entry.displayName)).toEqual(["one again", "two"]);
    await expect(history.getRecentAsync(1)).resolves.toMatchObject([{ path: "/work/one" }]);
  });

  it("caps stored history and can clear it", async () => {
    const history = await importHistory();

    for (let i = 0; i < 25; i++) {
      history.addRecent(`/work/${i}`, String(i));
    }

    expect(history.loadHistory().recent).toHaveLength(20);
    history.clearHistory();
    expect(history.loadHistory()).toEqual({ recent: [] });
  });

  it("writes command files used by shell integration", async () => {
    const history = await importHistory();

    history.writeLastCommand(["cd /work/app", "npm test"]);

    expect(readFileSync(history.getCommandFile(), "utf-8")).toBe("cd /work/app\nnpm test");
    expect(history.getConfigDir()).toBe(join(home!, ".dash-cli"));
  });
});
