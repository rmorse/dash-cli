export interface Project {
  name: string;
  path: string;
  isGitRepo: boolean;
  hasNestedProjects?: boolean;
  nestedProjects?: Project[];
}

export interface HistoryEntry {
  path: string;
  displayName: string;
  lastUsed: number;
}

export interface HistoryData {
  recent: HistoryEntry[];
}

// New Favorites System
export interface Favorite {
  id: string;
  name: string;
  shortcut: string;
  caseSensitive: boolean;
  command: string[];
  createdAt: number;
}

export type FavoriteInput = Omit<Favorite, "id" | "createdAt">;
export type FavoriteUpdate = Partial<FavoriteInput>;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface FavoritesData {
  favorites: Favorite[];
}

export interface SelectItem {
  label: string;
  value: string;
  isHeader?: boolean;
}

// Re-export settings types
export type { Settings, SettingField } from "./settings.js";
export { DEFAULT_SETTINGS, SETTING_FIELDS } from "./settings.js";
