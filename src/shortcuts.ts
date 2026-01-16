import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import type {
  Shortcut,
  ShortcutInput,
  ShortcutUpdate,
  ShortcutsData,
  ValidationResult,
} from "./types.js";

const CONFIG_DIR = join(homedir(), ".dash-cli");
const SHORTCUTS_FILE = join(CONFIG_DIR, "shortcuts.json");

// ============================================================================
// Private Helpers
// ============================================================================

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function loadShortcutsData(): ShortcutsData {
  ensureConfigDir();

  if (!existsSync(SHORTCUTS_FILE)) {
    return { shortcuts: [] };
  }

  try {
    const content = readFileSync(SHORTCUTS_FILE, "utf-8");
    return JSON.parse(content) as ShortcutsData;
  } catch {
    return { shortcuts: [] };
  }
}

function saveShortcutsData(data: ShortcutsData): void {
  ensureConfigDir();
  writeFileSync(SHORTCUTS_FILE, JSON.stringify(data, null, 2));
}

/**
 * Ensures all shortcuts have an order field.
 * Assigns sequential order based on createdAt sort for migration.
 */
function ensureOrderField(shortcuts: Shortcut[]): Shortcut[] {
  const needsUpdate = shortcuts.some((s) => s.order === undefined);
  if (!needsUpdate) return shortcuts;

  // Sort by createdAt to establish baseline order for migration
  const sorted = [...shortcuts].sort((a, b) => a.createdAt - b.createdAt);
  return sorted.map((shortcut, index) => ({
    ...shortcut,
    order: shortcut.order ?? index,
  }));
}

/**
 * Normalizes order values to sequential 0..n-1.
 */
function normalizeOrder(shortcuts: Shortcut[]): Shortcut[] {
  const sorted = [...shortcuts].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return sorted.map((shortcut, index) => ({
    ...shortcut,
    order: index,
  }));
}

/**
 * Checks if two triggers collide considering case-sensitivity rules.
 *
 * Collision occurs when:
 * - Both are case-sensitive and exact match
 * - At least one is case-insensitive and lowercase values match
 */
function triggersCollide(
  trigger1: string,
  caseSensitive1: boolean,
  trigger2: string,
  caseSensitive2: boolean
): boolean {
  // If both are case-sensitive, exact match required for collision
  if (caseSensitive1 && caseSensitive2) {
    return trigger1 === trigger2;
  }

  // If either is case-insensitive, compare lowercase
  return trigger1.toLowerCase() === trigger2.toLowerCase();
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates a trigger string format.
 */
export function validateTriggerFormat(trigger: string): ValidationResult {
  if (!trigger || trigger.trim() === "") {
    return { valid: false, error: "Trigger cannot be empty" };
  }

  if (trigger.includes(" ")) {
    return { valid: false, error: "Trigger cannot contain spaces" };
  }

  if (trigger.startsWith("--")) {
    return { valid: false, error: "Trigger cannot start with '--'" };
  }

  return { valid: true };
}

/**
 * Validates that a trigger is unique among existing shortcuts.
 */
export function validateTrigger(
  trigger: string,
  caseSensitive: boolean,
  excludeId?: string
): ValidationResult {
  const formatResult = validateTriggerFormat(trigger);
  if (!formatResult.valid) {
    return formatResult;
  }

  const data = loadShortcutsData();

  for (const shortcut of data.shortcuts) {
    if (excludeId && shortcut.id === excludeId) {
      continue;
    }

    if (
      triggersCollide(
        trigger,
        caseSensitive,
        shortcut.trigger,
        shortcut.caseSensitive
      )
    ) {
      const sensitivity = shortcut.caseSensitive
        ? "case-sensitive"
        : "case-insensitive";
      return {
        valid: false,
        error: `Trigger "${trigger}" collides with "${shortcut.trigger}" (${sensitivity}) on "${shortcut.name}"`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validates a command array.
 */
export function validateCommand(command: string[]): ValidationResult {
  if (!command || !Array.isArray(command)) {
    return { valid: false, error: "Command must be an array" };
  }

  if (command.length === 0) {
    return { valid: false, error: "Command array cannot be empty" };
  }

  const hasNonEmpty = command.some((cmd) => cmd && cmd.trim() !== "");
  if (!hasNonEmpty) {
    return {
      valid: false,
      error: "Command array must contain at least one non-empty command",
    };
  }

  return { valid: true };
}

/**
 * Validates a complete shortcut input.
 */
export function validateShortcutInput(
  input: ShortcutInput,
  excludeId?: string
): ValidationResult {
  if (!input.name || input.name.trim() === "") {
    return { valid: false, error: "Name cannot be empty" };
  }

  const triggerResult = validateTrigger(
    input.trigger,
    input.caseSensitive,
    excludeId
  );
  if (!triggerResult.valid) {
    return triggerResult;
  }

  const commandResult = validateCommand(input.command);
  if (!commandResult.valid) {
    return commandResult;
  }

  return { valid: true };
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Retrieves all shortcuts, sorted by order.
 */
export function getShortcuts(): Shortcut[] {
  const data = loadShortcutsData();
  const withOrder = ensureOrderField(data.shortcuts);
  return withOrder.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * Retrieves a shortcut by its ID.
 */
export function getShortcutById(id: string): Shortcut | undefined {
  const data = loadShortcutsData();
  return data.shortcuts.find((s) => s.id === id);
}

/**
 * Retrieves a shortcut by its trigger.
 * Handles case-sensitivity according to each shortcut's setting.
 */
export function getShortcutByTrigger(trigger: string): Shortcut | undefined {
  const data = loadShortcutsData();
  const lowerTrigger = trigger.toLowerCase();

  return data.shortcuts.find((shortcut) => {
    if (shortcut.caseSensitive) {
      return shortcut.trigger === trigger;
    } else {
      return shortcut.trigger.toLowerCase() === lowerTrigger;
    }
  });
}

/**
 * Adds a new shortcut.
 */
export function addShortcut(input: ShortcutInput): Shortcut {
  const validation = validateShortcutInput(input);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const data = loadShortcutsData();
  data.shortcuts = ensureOrderField(data.shortcuts);

  // New shortcut gets last position
  const maxOrder = data.shortcuts.reduce((max, s) => Math.max(max, s.order ?? 0), -1);

  const newShortcut: Shortcut = {
    id: randomUUID(),
    name: input.name.trim(),
    trigger: input.trigger,
    caseSensitive: input.caseSensitive,
    command: input.command.filter((cmd) => cmd.trim() !== ""),
    pinned: input.pinned ?? true,
    order: maxOrder + 1,
    createdAt: Date.now(),
  };

  data.shortcuts.push(newShortcut);
  data.shortcuts = normalizeOrder(data.shortcuts);
  saveShortcutsData(data);

  return newShortcut;
}

/**
 * Updates an existing shortcut.
 */
export function updateShortcut(id: string, updates: ShortcutUpdate): Shortcut {
  const data = loadShortcutsData();
  const index = data.shortcuts.findIndex((s) => s.id === id);

  if (index === -1) {
    throw new Error(`Shortcut with ID "${id}" not found`);
  }

  const existing = data.shortcuts[index];

  const merged: ShortcutInput = {
    name: updates.name ?? existing.name,
    trigger: updates.trigger ?? existing.trigger,
    caseSensitive: updates.caseSensitive ?? existing.caseSensitive,
    command: updates.command ?? existing.command,
    pinned: updates.pinned ?? existing.pinned,
  };

  const validation = validateShortcutInput(merged, id);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const updated: Shortcut = {
    ...existing,
    name: merged.name.trim(),
    trigger: merged.trigger,
    caseSensitive: merged.caseSensitive,
    command: merged.command.filter((cmd) => cmd.trim() !== ""),
    pinned: merged.pinned ?? true,
  };

  data.shortcuts[index] = updated;
  saveShortcutsData(data);

  return updated;
}

/**
 * Removes a shortcut by its ID.
 */
export function removeShortcut(id: string): boolean {
  const data = loadShortcutsData();
  const initialLength = data.shortcuts.length;

  data.shortcuts = data.shortcuts.filter((s) => s.id !== id);

  if (data.shortcuts.length < initialLength) {
    data.shortcuts = normalizeOrder(data.shortcuts);
    saveShortcutsData(data);
    return true;
  }

  return false;
}

/**
 * Removes all shortcuts.
 */
export function clearShortcuts(): void {
  saveShortcutsData({ shortcuts: [] });
}

/**
 * Moves a shortcut to a new position in the order.
 */
export function moveShortcut(id: string, targetIndex: number): Shortcut[] {
  const data = loadShortcutsData();
  data.shortcuts = ensureOrderField(data.shortcuts);

  // Sort by current order
  const sorted = data.shortcuts.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const currentIndex = sorted.findIndex((s) => s.id === id);
  if (currentIndex === -1) {
    throw new Error(`Shortcut with ID "${id}" not found`);
  }

  // Bounds check
  const clampedTarget = Math.max(0, Math.min(targetIndex, sorted.length - 1));

  // Remove from current position and insert at new position
  const [moved] = sorted.splice(currentIndex, 1);
  sorted.splice(clampedTarget, 0, moved);

  // Assign new order values (don't use normalizeOrder - it re-sorts by old order)
  data.shortcuts = sorted.map((shortcut, index) => ({
    ...shortcut,
    order: index,
  }));
  saveShortcutsData(data);

  return data.shortcuts;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generates a default command array from a path.
 */
export function generateCommand(path: string): string[] {
  // Escape quotes in path for shell safety
  const escapedPath = path.replace(/"/g, '\\"');
  return [`cd "${escapedPath}"`];
}

/**
 * Generates a unique trigger (next available number).
 */
export function generateUniqueTrigger(shortcuts: Shortcut[]): string {
  const existing = new Set(shortcuts.map((s) => s.trigger.toLowerCase()));
  let num = 1;
  while (existing.has(String(num))) {
    num++;
  }
  return String(num);
}

/**
 * Finds a shortcut that has a cd command to the given path.
 */
export function findShortcutByPath(path: string): Shortcut | undefined {
  const shortcuts = getShortcuts();
  const expectedCmd = generateCommand(path)[0];

  return shortcuts.find((s) => s.command.some((cmd) => cmd === expectedCmd));
}

// ============================================================================
// Async Versions (for non-blocking startup)
// ============================================================================

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureConfigDirAsync(): Promise<void> {
  if (!(await pathExists(CONFIG_DIR))) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
}

async function loadShortcutsDataAsync(): Promise<ShortcutsData> {
  await ensureConfigDirAsync();

  if (!(await pathExists(SHORTCUTS_FILE))) {
    return { shortcuts: [] };
  }

  try {
    const content = await readFile(SHORTCUTS_FILE, "utf-8");
    return JSON.parse(content) as ShortcutsData;
  } catch {
    return { shortcuts: [] };
  }
}

/**
 * Async version of getShortcuts for non-blocking startup.
 */
export async function getShortcutsAsync(): Promise<Shortcut[]> {
  const data = await loadShortcutsDataAsync();
  const withOrder = ensureOrderField(data.shortcuts);
  return withOrder.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * Async version of getShortcutByTrigger.
 */
export async function getShortcutByTriggerAsync(
  trigger: string
): Promise<Shortcut | undefined> {
  const data = await loadShortcutsDataAsync();
  const lowerTrigger = trigger.toLowerCase();

  return data.shortcuts.find((shortcut) => {
    if (shortcut.caseSensitive) {
      return shortcut.trigger === trigger;
    } else {
      return shortcut.trigger.toLowerCase() === lowerTrigger;
    }
  });
}
