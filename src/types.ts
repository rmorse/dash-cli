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

export interface FavoriteEntry {
  path: string;
  displayName: string;
  addedAt: number;
}

export interface HistoryData {
  recent: HistoryEntry[];
}

export interface FavoritesData {
  favorites: FavoriteEntry[];
}

export interface SelectItem {
  label: string;
  value: string;
  isHeader?: boolean;
}

// Re-export settings types
export type { Settings, SettingField } from "./settings.js";
export { DEFAULT_SETTINGS, SETTING_FIELDS } from "./settings.js";
