import { readdirSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import micromatch from "micromatch";
import type { Project, Settings } from "./types.js";
import { DEFAULT_SETTINGS } from "./settings.js";

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
 * Parse skip patterns from comma-separated string
 */
function parseSkipPatterns(skipDirs: string): string[] {
  return skipDirs
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Check if a directory name should be skipped
 */
function shouldSkip(name: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (pattern.includes("*")) {
      return micromatch.isMatch(name, pattern);
    }
    return name === pattern;
  });
}

/**
 * Scan a directory for nested git projects
 */
function findNestedProjects(
  dir: string,
  skipPatterns: string[],
  maxDepth: number,
  depth: number = 0
): Project[] {
  if (depth > maxDepth) return [];

  const projects: Project[] = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      if (shouldSkip(entry, skipPatterns)) continue;

      const fullPath = join(dir, entry);

      try {
        const stat = statSync(fullPath);
        if (!stat.isDirectory()) continue;

        const gitPath = join(fullPath, ".git");
        const isGitRepo = existsSync(gitPath);

        // Recursively find nested projects
        const nested = findNestedProjects(fullPath, skipPatterns, maxDepth, depth + 1);

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
export function scanProjects(settings?: Settings): Project[] {
  const config = settings ?? DEFAULT_SETTINGS;
  const projectsDir = config.projectsDir;
  const maxDepth = config.maxDepth;
  const skipPatterns = parseSkipPatterns(config.skipDirs);

  if (!existsSync(projectsDir)) {
    return [];
  }

  const allProjects = findNestedProjects(projectsDir, skipPatterns, maxDepth, 0);
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
