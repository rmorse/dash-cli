import { existsSync, readFileSync } from "node:fs";
import fg from "fast-glob";
import { join, basename, dirname, relative, resolve } from "node:path";
import type { Project, Settings } from "./types.js";
import { DEFAULT_SETTINGS } from "./settings.js";
import { log } from "./logger.js";

// Abort signal for cancelling scans
export interface ScanAbortSignal {
  aborted: boolean;
}

// Detect if running in WSL
let isWSL: boolean | null = null;
function detectWSL(): boolean {
  if (isWSL !== null) return isWSL;
  try {
    const procVersion = readFileSync("/proc/version", "utf-8").toLowerCase();
    isWSL = procVersion.includes("microsoft") || procVersion.includes("wsl");
  } catch {
    isWSL = false;
  }
  log(`detectWSL: isWSL=${isWSL}`);
  return isWSL;
}

// Convert Windows path to WSL path if needed (D:\projects -> /mnt/d/projects)
function toNativePath(windowsPath: string): string {
  if (!detectWSL()) return windowsPath;

  // Check if it's a Windows-style path (e.g., D:\projects or D:/projects)
  const match = windowsPath.match(/^([a-zA-Z]):[/\\](.*)$/);
  if (match) {
    const drive = match[1].toLowerCase();
    const rest = match[2].replace(/\\/g, "/");
    const wslPath = `/mnt/${drive}/${rest}`;
    log(`toNativePath: converted ${windowsPath} -> ${wslPath}`);
    return wslPath;
  }
  return windowsPath;
}

/**
 * Parse skip patterns from comma-separated string into glob ignore patterns
 */
function parseSkipPatterns(skipDirs: string): string[] {
  const patterns = skipDirs
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => `**/${p}/**`);  // Convert to glob ignore format

  return patterns;
}

/**
 * Build a nested project tree from flat list of project paths.
 * Creates intermediate folder nodes for non-git-repo directories that contain repos.
 */
function buildProjectTree(projectPaths: string[], projectsDir: string): Project[] {
  // Normalize projectsDir using resolve for consistent comparisons
  const normalizedProjectsDir = resolve(projectsDir);
  log(`buildProjectTree: projectsDir="${projectsDir}" -> normalized="${normalizedProjectsDir}"`);
  log(`buildProjectTree: processing ${projectPaths.length} paths`);

  // Map to store all nodes by their full path
  const nodeMap = new Map<string, Project>();

  for (const fullPath of projectPaths) {
    // Get path relative to projectsDir and split into segments
    const relativePath = relative(normalizedProjectsDir, fullPath);
    const segments = relativePath.split(/[/\\]/);

    // Build nodes for each path segment
    let currentFullPath = normalizedProjectsDir;
    let parentNode: Project | undefined;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      currentFullPath = join(currentFullPath, segment);
      const isLastSegment = i === segments.length - 1;

      let node = nodeMap.get(currentFullPath);
      if (!node) {
        node = {
          name: segment,
          path: currentFullPath,
          isGitRepo: isLastSegment, // Only the actual project path is a git repo
          hasNestedProjects: false,
          nestedProjects: undefined,
        };
        nodeMap.set(currentFullPath, node);

        if (parentNode) {
          if (!parentNode.nestedProjects) {
            parentNode.nestedProjects = [];
          }
          parentNode.nestedProjects.push(node);
          parentNode.hasNestedProjects = true;
        }
      } else if (isLastSegment) {
        // Node already exists (as intermediate folder), mark it as a git repo too
        node.isGitRepo = true;
      }

      parentNode = node;
    }
  }

  // Collect root nodes (direct children of projectsDir)
  const rootProjects: Project[] = [];
  for (const [path, node] of nodeMap) {
    if (dirname(path) === normalizedProjectsDir) {
      rootProjects.push(node);
    }
  }
  log(`buildProjectTree: found ${rootProjects.length} root projects`);

  // Sort all project lists alphabetically
  const sortProjects = (projects: Project[]): Project[] => {
    for (const p of projects) {
      if (p.nestedProjects) {
        p.nestedProjects = sortProjects(p.nestedProjects);
      }
    }
    return projects.sort((a, b) => a.name.localeCompare(b.name));
  };

  return sortProjects(rootProjects);
}

/**
 * Scan the root projects directory (sync version using fast-glob sync)
 */
export function scanProjects(settings?: Settings): Project[] {
  const config = settings ?? DEFAULT_SETTINGS;
  const projectsDir = toNativePath(config.projectsDir);
  const maxDepth = config.maxDepth;
  const ignorePatterns = parseSkipPatterns(config.skipDirs);

  if (!existsSync(projectsDir)) {
    return [];
  }

  try {
    // Find all .git directories
    const gitDirs = fg.sync("**/.git", {
      cwd: projectsDir,
      onlyDirectories: true,
      deep: maxDepth + 1,  // +1 because .git is inside the project
      ignore: ignorePatterns,
      followSymbolicLinks: false,
      suppressErrors: true,
    });

    // Convert to full paths (parent of .git)
    const projectPaths = gitDirs.map((g) => join(projectsDir, dirname(g)));

    return buildProjectTree(projectPaths, projectsDir);
  } catch {
    return [];
  }
}

/**
 * Scan the root projects directory (async version with fast-glob)
 */
export async function scanProjectsAsync(settings?: Settings, signal?: ScanAbortSignal): Promise<Project[]> {
  const config = settings ?? DEFAULT_SETTINGS;
  const projectsDir = toNativePath(config.projectsDir);
  const maxDepth = config.maxDepth;
  const ignorePatterns = parseSkipPatterns(config.skipDirs);
  const abortSignal = signal ?? { aborted: false };

  log(`scanProjectsAsync: starting glob scan of ${projectsDir}, maxDepth=${maxDepth}`);

  if (!existsSync(projectsDir)) {
    log(`scanProjectsAsync: projectsDir does not exist`);
    return [];
  }

  try {
    // Find all .git directories with fast-glob
    log(`scanProjectsAsync: running fast-glob for **/.git`);
    const gitDirs = await fg("**/.git", {
      cwd: projectsDir,
      onlyDirectories: true,
      deep: maxDepth + 1,  // +1 because .git is inside the project
      ignore: ignorePatterns,
      followSymbolicLinks: false,
      suppressErrors: true,
    });

    log(`scanProjectsAsync: found ${gitDirs.length} git repos`);

    if (abortSignal.aborted) {
      log(`scanProjectsAsync: scan was aborted`);
      return [];
    }

    // Convert to full paths (parent of .git)
    const projectPaths = gitDirs.map((g) => join(projectsDir, dirname(g)));

    // Build nested tree structure
    const projects = buildProjectTree(projectPaths, projectsDir);
    log(`scanProjectsAsync: built tree with ${projects.length} root projects`);

    return projects;
  } catch (e) {
    log(`scanProjectsAsync: error - ${e}`);
    return [];
  }
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
