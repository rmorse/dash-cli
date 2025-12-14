import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_DIR = join(homedir(), ".dash-cli");
const SETTINGS_FILE = join(CONFIG_DIR, "settings.json");

export interface Settings {
  projectsDir: string;
  maxDepth: number;
  skipDirs: string;
  recentCount: number;
  visibleRows: number;
  selectedColor: string;
  shortcutColor: string;
  recentColor: string;
  shortcutToggleKey: string;
  refreshKey: string;
}

export const DEFAULT_SETTINGS: Settings = {
  projectsDir: "",
  maxDepth: 4,
  skipDirs: "node_modules,vendor,dist,build,.next,__pycache__,target,.svn,.expo,.gradle,wp-admin,wp-includes,wp-content,*.app,release,incremental,pristine,tags",
  recentCount: 5,
  visibleRows: 12,
  selectedColor: "#FFD700",
  shortcutColor: "#69FFBE",
  recentColor: "#6495ED",
  shortcutToggleKey: "t",
  refreshKey: "r",
};

export interface SettingField {
  key: keyof Settings;
  label: string;
  type: "path" | "number" | "text" | "color" | "key";
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
    key: "shortcutColor",
    label: "Shortcut Color",
    type: "color",
    description: "Highlight color for shortcut items (hex)",
  },
  {
    key: "recentColor",
    label: "Recent Color",
    type: "color",
    description: "Highlight color for recent items (hex)",
  },
  {
    key: "shortcutToggleKey",
    label: "Shortcut Toggle Key",
    type: "key",
    description: "Key for Ctrl+? to toggle shortcut (letter or number)",
  },
  {
    key: "refreshKey",
    label: "Refresh Shortcut",
    type: "key",
    description: "Key for Ctrl+? to refresh projects (letter or number)",
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

export async function loadSettingsAsync(): Promise<Settings> {
  await ensureConfigDirAsync();

  if (!await pathExists(SETTINGS_FILE)) {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    const content = await readFile(SETTINGS_FILE, "utf-8");
    const loaded = JSON.parse(content) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...loaded };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
