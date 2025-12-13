import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Project } from "./types.js";
import { log } from "./logger.js";

const CONFIG_DIR = join(homedir(), ".dash-cli");
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
  log(`loadCache: checking if cache exists at ${CACHE_FILE}`);
  if (!existsSync(CACHE_FILE)) {
    log("loadCache: no cache file");
    return null;
  }

  try {
    log("loadCache: reading cache file...");
    const content = readFileSync(CACHE_FILE, "utf-8");
    log(`loadCache: read ${content.length} bytes, parsing...`);
    const cache: CacheData = JSON.parse(content);
    log("loadCache: parsed successfully");

    // Validate cache matches current settings
    if (
      cache.projectsDir !== projectsDir ||
      cache.maxDepth !== maxDepth ||
      cache.skipDirs !== skipDirs
    ) {
      log("loadCache: cache settings mismatch");
      return null;
    }

    log(`loadCache: returning ${cache.projects.length} cached projects`);
    return cache.projects;
  } catch (e) {
    log(`loadCache: error - ${e}`);
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
