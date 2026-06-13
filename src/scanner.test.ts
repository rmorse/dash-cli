import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findProjectByPath, getAllProjectPaths, scanProjects, scanProjectsAsync } from "./scanner.js";
import type { Settings } from "./types.js";

let root: string | null = null;

function createRoot(): string {
  root = mkdtempSync(join(tmpdir(), "dash-scan-"));
  return root;
}

function settings(projectsDir: string, overrides: Partial<Settings> = {}): Settings {
  return {
    projectsDir,
    maxDepth: 4,
    skipDirs: "node_modules,dist",
    showShortcuts: true,
    showRecent: true,
    recentCount: 5,
    visibleRows: 12,
    selectedColor: "#FFD700",
    shortcutColor: "#69FFBE",
    recentColor: "#6495ED",
    shortcutToggleKey: "t",
    refreshKey: "r",
    moveKey: "o",
    ...overrides,
  };
}

afterEach(() => {
  if (root) {
    rmSync(root, { recursive: true, force: true });
    root = null;
  }
});

describe("scanner", () => {
  it("builds a nested project tree from .git directories and files", async () => {
    const projectsDir = createRoot();
    mkdirSync(join(projectsDir, "alpha", ".git"), { recursive: true });
    mkdirSync(join(projectsDir, "group", "beta"), { recursive: true });
    writeFileSync(join(projectsDir, "group", "beta", ".git"), "gitdir: ../.git/worktrees/beta");
    mkdirSync(join(projectsDir, "node_modules", "ignored", ".git"), { recursive: true });

    const result = scanProjects(settings(projectsDir));

    expect(result.map((project) => project.name)).toEqual(["alpha", "group"]);
    expect(result[1]).toMatchObject({ name: "group", isGitRepo: false, hasNestedProjects: true });
    expect(result[1].nestedProjects?.[0]).toMatchObject({ name: "beta", isGitRepo: true });

    await expect(scanProjectsAsync(settings(projectsDir))).resolves.toEqual(result);
  });

  it("respects missing roots, depth, aborts, and project lookup helpers", async () => {
    const projectsDir = createRoot();
    mkdirSync(join(projectsDir, "deep", "child", ".git"), { recursive: true });

    expect(scanProjects(settings(join(projectsDir, "missing")))).toEqual([]);
    expect(scanProjects(settings(projectsDir, { maxDepth: 1 }))).toEqual([]);
    await expect(scanProjectsAsync(settings(projectsDir), { aborted: true })).resolves.toEqual([]);

    const projects = await scanProjectsAsync(settings(projectsDir));
    const all = getAllProjectPaths(projects);
    const childPath = join(projectsDir, "deep", "child");
    expect(all.get(childPath)?.name).toBe("child");
    expect(findProjectByPath(projects, childPath)?.path).toBe(childPath);
    expect(findProjectByPath(projects, join(projectsDir, "none"))).toBeUndefined();
  });
});
