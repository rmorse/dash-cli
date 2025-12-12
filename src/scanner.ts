import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Project } from "./types.js";

const PROJECTS_DIR = "D:\\projects";

export function scanProjects(): Project[] {
  const projects: Project[] = [];

  if (!existsSync(PROJECTS_DIR)) {
    return projects;
  }

  const entries = readdirSync(PROJECTS_DIR);

  for (const entry of entries) {
    const fullPath = join(PROJECTS_DIR, entry);

    try {
      const stat = statSync(fullPath);
      if (!stat.isDirectory()) continue;

      const gitPath = join(fullPath, ".git");
      const isGitRepo = existsSync(gitPath);

      projects.push({
        name: entry,
        path: fullPath,
        isGitRepo,
      });
    } catch {
      // Skip entries we can't access
    }
  }

  // Sort alphabetically
  return projects.sort((a, b) => a.name.localeCompare(b.name));
}
