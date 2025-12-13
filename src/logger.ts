import { appendFileSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// Log to user's config folder
const CONFIG_DIR = join(homedir(), ".dash-cli");
const LOG_FILE = join(CONFIG_DIR, "debug.log");

let debugEnabled = false;
let startTime: number | null = null;

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function initLog(enabled: boolean): void {
  debugEnabled = enabled;
  if (!debugEnabled) return;

  ensureConfigDir();
  startTime = Date.now();
  // Start fresh log file for each debug session
  writeFileSync(LOG_FILE, `=== Debug log started at ${new Date().toISOString()} ===\n`);
}

export function log(message: string): void {
  if (!debugEnabled) return;

  ensureConfigDir();
  const elapsed = startTime ? Date.now() - startTime : 0;
  const line = `[+${elapsed.toString().padStart(6)}ms] ${message}\n`;
  appendFileSync(LOG_FILE, line);
}
