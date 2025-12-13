import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { HistoryData, HistoryEntry } from "./types.js";

const CONFIG_DIR = join(homedir(), ".projects-cli");
const HISTORY_FILE = join(CONFIG_DIR, "history.json");
const SELECTION_FILE = join(CONFIG_DIR, "last-selection");
const MAX_HISTORY = 20;

export function getConfigDir(): string {
  return CONFIG_DIR;
}

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadHistory(): HistoryData {
  ensureConfigDir();

  if (!existsSync(HISTORY_FILE)) {
    return { recent: [] };
  }

  try {
    const content = readFileSync(HISTORY_FILE, "utf-8");
    return JSON.parse(content) as HistoryData;
  } catch {
    return { recent: [] };
  }
}

export function saveHistory(data: HistoryData): void {
  ensureConfigDir();
  writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2));
}

export function getRecent(limit: number = 5): HistoryEntry[] {
  const data = loadHistory();
  return data.recent
    .sort((a, b) => b.lastUsed - a.lastUsed)
    .slice(0, limit);
}

export function addRecent(path: string, displayName: string): void {
  const data = loadHistory();

  // Remove existing entry for this path
  data.recent = data.recent.filter((entry) => entry.path !== path);

  // Add new entry at the beginning
  data.recent.unshift({
    path,
    displayName,
    lastUsed: Date.now(),
  });

  // Trim to max size
  data.recent = data.recent.slice(0, MAX_HISTORY);

  saveHistory(data);
}

export function writeLastSelection(path: string): void {
  ensureConfigDir();
  writeFileSync(SELECTION_FILE, path);
}

export function clearHistory(): void {
  saveHistory({ recent: [] });
}

export function getSelectionFile(): string {
  return SELECTION_FILE;
}
