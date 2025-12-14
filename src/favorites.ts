import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import type {
  Favorite,
  FavoriteInput,
  FavoriteUpdate,
  FavoritesData,
  ValidationResult,
} from "./types.js";

const CONFIG_DIR = join(homedir(), ".dash-cli");
const FAVORITES_FILE = join(CONFIG_DIR, "favorites.json");

// ============================================================================
// Private Helpers
// ============================================================================

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function loadFavoritesData(): FavoritesData {
  ensureConfigDir();

  if (!existsSync(FAVORITES_FILE)) {
    return { favorites: [] };
  }

  try {
    const content = readFileSync(FAVORITES_FILE, "utf-8");
    return JSON.parse(content) as FavoritesData;
  } catch {
    return { favorites: [] };
  }
}

function saveFavoritesData(data: FavoritesData): void {
  ensureConfigDir();
  writeFileSync(FAVORITES_FILE, JSON.stringify(data, null, 2));
}

/**
 * Checks if two shortcuts collide considering case-sensitivity rules.
 *
 * Collision occurs when:
 * - Both are case-sensitive and exact match
 * - At least one is case-insensitive and lowercase values match
 */
function shortcutsCollide(
  shortcut1: string,
  caseSensitive1: boolean,
  shortcut2: string,
  caseSensitive2: boolean
): boolean {
  // If both are case-sensitive, exact match required for collision
  if (caseSensitive1 && caseSensitive2) {
    return shortcut1 === shortcut2;
  }

  // If either is case-insensitive, compare lowercase
  return shortcut1.toLowerCase() === shortcut2.toLowerCase();
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates a shortcut string format.
 */
export function validateShortcutFormat(shortcut: string): ValidationResult {
  if (!shortcut || shortcut.trim() === "") {
    return { valid: false, error: "Shortcut cannot be empty" };
  }

  if (shortcut.includes(" ")) {
    return { valid: false, error: "Shortcut cannot contain spaces" };
  }

  return { valid: true };
}

/**
 * Validates that a shortcut is unique among existing favorites.
 */
export function validateShortcut(
  shortcut: string,
  caseSensitive: boolean,
  excludeId?: string
): ValidationResult {
  const formatResult = validateShortcutFormat(shortcut);
  if (!formatResult.valid) {
    return formatResult;
  }

  const data = loadFavoritesData();

  for (const favorite of data.favorites) {
    if (excludeId && favorite.id === excludeId) {
      continue;
    }

    if (
      shortcutsCollide(
        shortcut,
        caseSensitive,
        favorite.shortcut,
        favorite.caseSensitive
      )
    ) {
      const sensitivity = favorite.caseSensitive
        ? "case-sensitive"
        : "case-insensitive";
      return {
        valid: false,
        error: `Shortcut "${shortcut}" collides with "${favorite.shortcut}" (${sensitivity}) on "${favorite.name}"`,
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
 * Validates a complete favorite input.
 */
export function validateFavoriteInput(
  input: FavoriteInput,
  excludeId?: string
): ValidationResult {
  if (!input.name || input.name.trim() === "") {
    return { valid: false, error: "Name cannot be empty" };
  }

  const shortcutResult = validateShortcut(
    input.shortcut,
    input.caseSensitive,
    excludeId
  );
  if (!shortcutResult.valid) {
    return shortcutResult;
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
 * Retrieves all favorites, sorted by creation date (oldest first).
 */
export function getFavorites(): Favorite[] {
  const data = loadFavoritesData();
  return data.favorites.sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Retrieves a favorite by its ID.
 */
export function getFavoriteById(id: string): Favorite | undefined {
  const data = loadFavoritesData();
  return data.favorites.find((f) => f.id === id);
}

/**
 * Retrieves a favorite by its shortcut.
 * Handles case-sensitivity according to each favorite's setting.
 */
export function getFavoriteByShortcut(shortcut: string): Favorite | undefined {
  const data = loadFavoritesData();
  const lowerShortcut = shortcut.toLowerCase();

  return data.favorites.find((favorite) => {
    if (favorite.caseSensitive) {
      return favorite.shortcut === shortcut;
    } else {
      return favorite.shortcut.toLowerCase() === lowerShortcut;
    }
  });
}

/**
 * Adds a new favorite.
 */
export function addFavorite(input: FavoriteInput): Favorite {
  const validation = validateFavoriteInput(input);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const data = loadFavoritesData();

  const newFavorite: Favorite = {
    id: randomUUID(),
    name: input.name.trim(),
    shortcut: input.shortcut,
    caseSensitive: input.caseSensitive,
    command: input.command.filter((cmd) => cmd.trim() !== ""),
    createdAt: Date.now(),
  };

  data.favorites.push(newFavorite);
  saveFavoritesData(data);

  return newFavorite;
}

/**
 * Updates an existing favorite.
 */
export function updateFavorite(id: string, updates: FavoriteUpdate): Favorite {
  const data = loadFavoritesData();
  const index = data.favorites.findIndex((f) => f.id === id);

  if (index === -1) {
    throw new Error(`Favorite with ID "${id}" not found`);
  }

  const existing = data.favorites[index];

  const merged: FavoriteInput = {
    name: updates.name ?? existing.name,
    shortcut: updates.shortcut ?? existing.shortcut,
    caseSensitive: updates.caseSensitive ?? existing.caseSensitive,
    command: updates.command ?? existing.command,
  };

  const validation = validateFavoriteInput(merged, id);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const updated: Favorite = {
    ...existing,
    name: merged.name.trim(),
    shortcut: merged.shortcut,
    caseSensitive: merged.caseSensitive,
    command: merged.command.filter((cmd) => cmd.trim() !== ""),
  };

  data.favorites[index] = updated;
  saveFavoritesData(data);

  return updated;
}

/**
 * Removes a favorite by its ID.
 */
export function removeFavorite(id: string): boolean {
  const data = loadFavoritesData();
  const initialLength = data.favorites.length;

  data.favorites = data.favorites.filter((f) => f.id !== id);

  if (data.favorites.length < initialLength) {
    saveFavoritesData(data);
    return true;
  }

  return false;
}

/**
 * Removes all favorites.
 */
export function clearFavorites(): void {
  saveFavoritesData({ favorites: [] });
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
 * Generates a unique shortcut (next available number).
 */
export function generateUniqueShortcut(favorites: Favorite[]): string {
  const existing = new Set(favorites.map((f) => f.shortcut.toLowerCase()));
  let num = 1;
  while (existing.has(String(num))) {
    num++;
  }
  return String(num);
}

/**
 * Finds a favorite that has a cd command to the given path.
 */
export function findFavoriteByPath(path: string): Favorite | undefined {
  const favorites = getFavorites();
  const expectedCmd = generateCommand(path)[0];

  return favorites.find((f) => f.command.some((cmd) => cmd === expectedCmd));
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

async function loadFavoritesDataAsync(): Promise<FavoritesData> {
  await ensureConfigDirAsync();

  if (!(await pathExists(FAVORITES_FILE))) {
    return { favorites: [] };
  }

  try {
    const content = await readFile(FAVORITES_FILE, "utf-8");
    return JSON.parse(content) as FavoritesData;
  } catch {
    return { favorites: [] };
  }
}

/**
 * Async version of getFavorites for non-blocking startup.
 */
export async function getFavoritesAsync(): Promise<Favorite[]> {
  const data = await loadFavoritesDataAsync();
  return data.favorites.sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Async version of getFavoriteByShortcut.
 */
export async function getFavoriteByShortcutAsync(
  shortcut: string
): Promise<Favorite | undefined> {
  const data = await loadFavoritesDataAsync();
  const lowerShortcut = shortcut.toLowerCase();

  return data.favorites.find((favorite) => {
    if (favorite.caseSensitive) {
      return favorite.shortcut === shortcut;
    } else {
      return favorite.shortcut.toLowerCase() === lowerShortcut;
    }
  });
}
