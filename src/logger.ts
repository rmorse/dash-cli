import { appendFileSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Log to project's ./logs folder
const LOGS_DIR = join(process.cwd(), "logs");
const LOG_FILE = join(LOGS_DIR, "debug.log");

let startTime: number | null = null;

function ensureLogsDir(): void {
  if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true });
  }
}

export function initLog(): void {
  ensureLogsDir();
  startTime = Date.now();
  // Use append to preserve early startup logs
  appendFileSync(LOG_FILE, `\n=== Log started at ${new Date().toISOString()} ===\n`);
}

export function log(message: string): void {
  ensureLogsDir();
  const elapsed = startTime ? Date.now() - startTime : 0;
  const line = `[+${elapsed.toString().padStart(6)}ms] ${message}\n`;
  appendFileSync(LOG_FILE, line);
}
