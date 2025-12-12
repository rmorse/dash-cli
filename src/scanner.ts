import { readdirSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import type { Project } from "./types.js";

const PROJECTS_DIR = "D:\\projects";
const MAX_DEPTH = 4;
const SKIP_DIRS = new Set([".git", "node_modules", "vendor", "dist", "build", ".next", "__pycache__"]);

/**
 * Check if a project tree contains any git repos
 */
function containsGitRepos(projects: Project[]): boolean {
  for (const p of projects) {
    if (p.isGitRepo) return true;
    if (p.nestedProjects && containsGitRepos(p.nestedProjects)) return true;
  }
  return false;
}

/**
 * Filter projects to only include git repos or containers of git repos
 */
function filterToGitProjects(projects: Project[]): Project[] {
  const filtered: Project[] = [];

  for (const p of projects) {
    // Filter nested projects first
    const filteredNested = p.nestedProjects ? filterToGitProjects(p.nestedProjects) : [];
    const hasNestedGitRepos = filteredNested.length > 0;

    // Only include if it's a git repo OR has nested git repos
    if (p.isGitRepo || hasNestedGitRepos) {
      filtered.push({
        ...p,
        hasNestedProjects: hasNestedGitRepos,
        nestedProjects: hasNestedGitRepos ? filteredNested : undefined,
      });
    }
  }

  return filtered;
}

/**
 * Scan a directory for nested git projects
 */
function findNestedProjects(dir: string, depth: number = 0): Project[] {
  if (depth > MAX_DEPTH) return [];

  const projects: Project[] = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry)) continue;

      const fullPath = join(dir, entry);

      try {
        const stat = statSync(fullPath);
        if (!stat.isDirectory()) continue;

        const gitPath = join(fullPath, ".git");
        const isGitRepo = existsSync(gitPath);

        // Recursively find nested projects
        const nested = findNestedProjects(fullPath, depth + 1);

        projects.push({
          name: entry,
          path: fullPath,
          isGitRepo,
          hasNestedProjects: nested.length > 0,
          nestedProjects: nested.length > 0 ? nested : undefined,
        });
      } catch {
        // Skip entries we can't access
      }
    }
  } catch {
    // Skip directories we can't read
  }

  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Scan the root projects directory
 */
export function scanProjects(): Project[] {
  if (!existsSync(PROJECTS_DIR)) {
    return [];
  }

  const allProjects = findNestedProjects(PROJECTS_DIR, 0);
  // Filter to only include git repos and their containers
  return filterToGitProjects(allProjects);
}

/**
 * Get a flat list of all projects (for searching/recent matching)
 */
export function getAllProjectPaths(projects: Project[]): Map<string, Project> {
  const map = new Map<string, Project>();

  function traverse(list: Project[]) {
    for (const project of list) {
      map.set(project.path, project);
      if (project.nestedProjects) {
        traverse(project.nestedProjects);
      }
    }
  }

  traverse(projects);
  return map;
}

/**
 * Find a project by path in the tree
 */
export function findProjectByPath(projects: Project[], path: string): Project | undefined {
  for (const project of projects) {
    if (project.path === path) return project;
    if (project.nestedProjects) {
      const found = findProjectByPath(project.nestedProjects, path);
      if (found) return found;
    }
  }
  return undefined;
}
