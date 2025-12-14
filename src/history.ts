import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { HistoryData, HistoryEntry } from "./types.js";

const CONFIG_DIR = join(homedir(), ".dash-cli");
const HISTORY_FILE = join(CONFIG_DIR, "history.json");
const COMMAND_FILE = join(CONFIG_DIR, "last-command");
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

export function writeLastCommand(commands: string[]): void {
  ensureConfigDir();
  writeFileSync(COMMAND_FILE, commands.join("\n"));
}

export function clearHistory(): void {
  saveHistory({ recent: [] });
}

export function getCommandFile(): string {
  return COMMAND_FILE;
}

// Async versions for faster startup
async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function ensureConfigDirAsync(): Promise<void> {
  if (!await pathExists(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
}

async function loadHistoryAsync(): Promise<HistoryData> {
  await ensureConfigDirAsync();

  if (!await pathExists(HISTORY_FILE)) {
    return { recent: [] };
  }

  try {
    const content = await readFile(HISTORY_FILE, "utf-8");
    return JSON.parse(content) as HistoryData;
  } catch {
    return { recent: [] };
  }
}

export async function getRecentAsync(limit: number = 5): Promise<HistoryEntry[]> {
  const data = await loadHistoryAsync();
  return data.recent
    .sort((a, b) => b.lastUsed - a.lastUsed)
    .slice(0, limit);
}
