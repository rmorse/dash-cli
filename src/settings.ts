import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_DIR = join(homedir(), ".projects-cli");
const SETTINGS_FILE = join(CONFIG_DIR, "settings.json");

export interface Settings {
  projectsDir: string;
  maxDepth: number;
  skipDirs: string;
  recentCount: number;
  visibleRows: number;
  selectedColor: string;
  favoriteColor: string;
  recentColor: string;
}

export const DEFAULT_SETTINGS: Settings = {
  projectsDir: "D:\\projects",
  maxDepth: 4,
  skipDirs: "node_modules,.git,vendor,dist,build,.next,__pycache__",
  recentCount: 5,
  visibleRows: 12,
  selectedColor: "#FFD700",
  favoriteColor: "#69FFBE",
  recentColor: "#6495ED",
};

export interface SettingField {
  key: keyof Settings;
  label: string;
  type: "path" | "number" | "text" | "color";
  min?: number;
  max?: number;
  description: string;
}

export const SETTING_FIELDS: SettingField[] = [
  {
    key: "projectsDir",
    label: "Projects Directory",
    type: "path",
    description: "Root directory to scan for projects",
  },
  {
    key: "maxDepth",
    label: "Scan Depth",
    type: "number",
    min: 1,
    max: 10,
    description: "How deep to scan for nested projects",
  },
  {
    key: "skipDirs",
    label: "Skip Directories",
    type: "text",
    description: "Comma-separated patterns (supports globs like *.test)",
  },
  {
    key: "recentCount",
    label: "Recent Count",
    type: "number",
    min: 1,
    max: 50,
    description: "Number of recent projects to show",
  },
  {
    key: "visibleRows",
    label: "Visible Rows",
    type: "number",
    min: 5,
    max: 30,
    description: "Number of rows visible in the list",
  },
  {
    key: "selectedColor",
    label: "Selected Color",
    type: "color",
    description: "Highlight color for selected item (hex)",
  },
  {
    key: "favoriteColor",
    label: "Favorite Color",
    type: "color",
    description: "Highlight color for favorite items (hex)",
  },
  {
    key: "recentColor",
    label: "Recent Color",
    type: "color",
    description: "Highlight color for recent items (hex)",
  },
];

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadSettings(): Settings {
  ensureConfigDir();

  if (!existsSync(SETTINGS_FILE)) {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    const content = readFileSync(SETTINGS_FILE, "utf-8");
    const loaded = JSON.parse(content) as Partial<Settings>;
    // Merge with defaults to handle missing fields
    return { ...DEFAULT_SETTINGS, ...loaded };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  ensureConfigDir();
  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}
