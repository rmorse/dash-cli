import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Project } from "./types.js";

const CONFIG_DIR = join(homedir(), ".projects-cli");
const CACHE_FILE = join(CONFIG_DIR, "cache.json");

interface CacheData {
  projects: Project[];
  projectsDir: string;
  maxDepth: number;
  skipDirs: string;
  timestamp: number;
}

/**
 * Load cached scan results if available
 */
export function loadCache(projectsDir: string, maxDepth: number, skipDirs: string): Project[] | null {
  if (!existsSync(CACHE_FILE)) {
    return null;
  }

  try {
    const content = readFileSync(CACHE_FILE, "utf-8");
    const cache: CacheData = JSON.parse(content);

    // Validate cache matches current settings
    if (
      cache.projectsDir !== projectsDir ||
      cache.maxDepth !== maxDepth ||
      cache.skipDirs !== skipDirs
    ) {
      return null;
    }

    return cache.projects;
  } catch {
    return null;
  }
}

/**
 * Save scan results to cache
 */
export function saveCache(
  projects: Project[],
  projectsDir: string,
  maxDepth: number,
  skipDirs: string
): void {
  const cache: CacheData = {
    projects,
    projectsDir,
    maxDepth,
    skipDirs,
    timestamp: Date.now(),
  };

  try {
    writeFileSync(CACHE_FILE, JSON.stringify(cache));
  } catch {
    // Ignore cache write errors
  }
}

/**
 * Clear the cache
 */
export function clearCache(): void {
  try {
    if (existsSync(CACHE_FILE)) {
      writeFileSync(CACHE_FILE, "{}");
    }
  } catch {
    // Ignore
  }
}
