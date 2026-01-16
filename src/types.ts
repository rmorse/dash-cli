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

// Shortcuts System
export interface Shortcut {
  id: string;
  name: string;
  trigger: string;
  caseSensitive: boolean;
  command: string[];
  pinned?: boolean;  // Default: true (backwards compat)
  order?: number;    // Display order (0-indexed, normalized)
  createdAt: number;
}

export type ShortcutInput = Omit<Shortcut, "id" | "createdAt">;
export type ShortcutUpdate = Partial<ShortcutInput>;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface ShortcutsData {
  shortcuts: Shortcut[];
}

export interface SelectItem {
  label: string;
  value: string;
  isHeader?: boolean;
}

// Re-export settings types
export type { Settings, SettingField } from "./settings.js";
export { DEFAULT_SETTINGS, SETTING_FIELDS } from "./settings.js";
