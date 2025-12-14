import React, { useState, useMemo, useEffect, useRef } from "react";
import { Box, Text, useInput, useApp } from "ink";
import Spinner from "ink-spinner";
import type { Project, HistoryEntry, Shortcut, Settings } from "../types.js";
import { basename, relative } from "node:path";
import { SettingsScreen } from "./Settings.js";
import { ShortcutsEditor } from "./ShortcutsEditor.js";
import { ShortcutEdit } from "./ShortcutEdit.js";
import { scanProjectsAsync, ScanAbortSignal } from "../scanner.js";
import { loadCacheAsync, saveCache } from "../cache.js";
import {
  addShortcut,
  removeShortcut,
  findShortcutByPath,
  generateCommand,
  generateUniqueTrigger,
} from "../shortcuts.js";
import { writeLastCommand } from "../history.js";
import { log } from "../logger.js";

const PAGE_SIZE = 10;

interface AppProps {
  initialSettings: Settings;
  recentEntries: HistoryEntry[];
  shortcutEntries: Shortcut[];
  onSelect: (path: string, displayName: string) => void;
  onSettingsSave: (settings: Settings) => void;
}

// Tab indices
const TAB_PROJECTS = 0;
const TAB_SHORTCUTS = 1;
const TAB_SETTINGS = 2;
const TAB_COUNT = 3;
const TAB_LABELS = ["Projects", "Shortcuts", "Settings"];

interface ListItem {
  type: "header" | "project" | "back";
  label: string;
  path?: string;
  selectionKey?: string;  // Unique key for selection tracking (sc-path, recent-path, path, __back__)
  project?: Project;
  isShortcut?: boolean;
  isRecent?: boolean;
  triggers?: string[];  // All shortcut triggers for this path
  shortcutId?: string;  // Shortcut ID (for shortcuts section items)
}

interface NavLevel {
  projects: Project[];
  parentPath: string | null;
  // Saved scroll/selection state for this level
  savedScrollOffset: number;
  savedSelectedKey: string | null;  // Selection by key, not index
}

// Get display name for a path (relative to projects dir)
function getDisplayName(path: string, projectsDir: string): string {
  const rel = relative(projectsDir, path);
  // Convert backslashes to forward slashes for consistent display
  return rel.replace(/\\/g, "/") || basename(path);
}

// Collect all nested git projects (flattened) from a project tree
function collectNestedGitProjects(project: Project, basePath: string): Project[] {
  const results: Project[] = [];

  function traverse(p: Project, relativePath: string) {
    if (p.isGitRepo) {
      results.push({
        ...p,
        name: relativePath,
        hasNestedProjects: false,
        nestedProjects: undefined,
      });
    }

    if (p.nestedProjects) {
      for (const nested of p.nestedProjects) {
        const newPath = relativePath ? `${relativePath}/${nested.name}` : nested.name;
        traverse(nested, newPath);
      }
    }
  }

  if (project.nestedProjects) {
    for (const nested of project.nestedProjects) {
      traverse(nested, nested.name);
    }
  }

  return results;
}

export function App({ initialSettings, recentEntries: initialRecentEntries, shortcutEntries: initialShortcutEntries, onSelect, onSettingsSave }: AppProps) {
  log("App component function called");
  const { exit } = useApp();

  // Tab-based navigation
  const [currentTab, setCurrentTab] = useState(TAB_PROJECTS);
  const [editingShortcutId, setEditingShortcutId] = useState<string | null>(null);

  const cycleTab = (reverse = false) => {
    setCurrentTab((prev) => {
      if (reverse) {
        return prev <= 0 ? TAB_COUNT - 1 : prev - 1;
      }
      return (prev + 1) % TAB_COUNT;
    });
    setEditingShortcutId(null); // Reset sub-navigation when cycling tabs
  };

  // Projects and settings state
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [settings, setSettings] = useState(initialSettings);
  const [recentEntries, setRecentEntries] = useState(initialRecentEntries);
  const [shortcutEntries, setShortcutEntries] = useState(initialShortcutEntries);

  // Delete confirmation state for shortcuts on main screen
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Abort signal for cancelling scans early (e.g., when user selects before scan completes)
  const scanAbortSignal = useRef<ScanAbortSignal>({ aborted: false });

  // Load from cache and/or scan on mount
  useEffect(() => {
    log("useEffect: mount - starting cache/scan");
    scanAbortSignal.current = { aborted: false };
    setIsRefreshing(true);

    // Load cache and scan in parallel - show whichever finishes first
    log("useEffect: starting async cache load and scan in parallel...");

    // Track if we've shown results yet
    let hasShownResults = false;

    // Load cache (async)
    loadCacheAsync(settings.projectsDir, settings.maxDepth, settings.skipDirs).then((cached) => {
      log(`useEffect: cache loaded, ${cached ? cached.length + " projects" : "no cache"}`);
      if (cached && !scanAbortSignal.current.aborted && !hasShownResults) {
        setProjects(cached);
        hasShownResults = true;
        log("useEffect: showing cached projects");
      }
    });

    // Scan (async)
    scanProjectsAsync(settings, scanAbortSignal.current).then((scanned) => {
      log(`useEffect: scan complete, ${scanned.length} projects`);
      if (!scanAbortSignal.current.aborted) {
        setProjects(scanned);
        setIsRefreshing(false);
        hasShownResults = true;
        saveCache(scanned, settings.projectsDir, settings.maxDepth, settings.skipDirs);
        log("useEffect: projects updated and cache saved");
      }
    });

    return () => {
      scanAbortSignal.current.aborted = true;
    };
  }, []);

  // Search state - just the term, no focus state
  const [searchTerm, setSearchTerm] = useState("");

  // Cache for flattened nested projects
  const [nestedCache, setNestedCache] = useState<Map<string, Project[]>>(() => new Map());

  // Navigation stack - initialize empty, will update when projects load
  const [navStack, setNavStack] = useState<NavLevel[]>([
    { projects: [], parentPath: null, savedScrollOffset: 0, savedSelectedKey: null }
  ]);

  // Update nav stack when projects finish loading
  useEffect(() => {
    if (projects) {
      setNavStack([{ projects, parentPath: null, savedScrollOffset: 0, savedSelectedKey: null }]);
    }
  }, [projects]);

  const currentLevel = navStack[navStack.length - 1];
  const currentProjects = currentLevel.projects;
  const isAtRoot = navStack.length === 1;

  // Track paths that have EXACT shortcut matches (single cd command only)
  // Only these should hide recent items - modified shortcuts shouldn't hide them
  const exactShortcutPaths = useMemo(() => {
    const paths = new Set<string>();
    for (const sc of shortcutEntries) {
      // Only exact match: single command that is just cd "/path"
      if (sc.command.length === 1) {
        const cmd = sc.command[0];
        const pathMatch = cmd.match(/^cd\s+"([^"]+)"$/);
        if (pathMatch) {
          paths.add(pathMatch[1]);
        }
      }
    }
    return paths;
  }, [shortcutEntries]);

  const recentPaths = useMemo(
    () => new Set(recentEntries.map((e) => e.path)),
    [recentEntries]
  );

  // Build flat map of all projects for recent lookup
  const allProjectsMap = useMemo(() => {
    const map = new Map<string, Project>();
    if (!projects) return map;
    function traverse(list: Project[]) {
      for (const p of list) {
        map.set(p.path, p);
        if (p.nestedProjects) traverse(p.nestedProjects);
      }
    }
    traverse(projects);
    return map;
  }, [projects]);

  // Build triggers lookup by path (for showing [trigger] tags on projects)
  // A project can have multiple shortcuts pointing to it
  const triggersByPath = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const sc of shortcutEntries) {
      // Only associate if the first command is a cd to this path
      const firstCmd = sc.command[0];
      if (firstCmd?.startsWith('cd ')) {
        const pathMatch = firstCmd.match(/^cd\s+"?([^"]+)"?$/);
        if (pathMatch) {
          const path = pathMatch[1];
          const existing = map.get(path) || [];
          existing.push(sc.trigger);
          map.set(path, existing);
        }
      }
    }
    return map;
  }, [shortcutEntries]);

  // Build list with sections and keyToIndex map (before filtering)
  const { unfilteredItems, unfilteredKeyToIndex } = useMemo(() => {
    const list: ListItem[] = [];
    const keyMap = new Map<string, number>();

    // Shortcuts section (only at root level, hidden when searching, respects showShortcuts setting)
    if (isAtRoot && settings.showShortcuts && shortcutEntries.length > 0 && !searchTerm) {
      list.push({ type: "header", label: "Shortcuts" });
      for (const sc of shortcutEntries) {
        // Extract path from cd command
        const cdCmd = sc.command.find(c => c.startsWith('cd '));
        const pathMatch = cdCmd?.match(/^cd\s+"?([^"]+)"?$/);
        const scPath = pathMatch?.[1] || "";
        const project = scPath ? allProjectsMap.get(scPath) : undefined;
        const selectionKey = `sc-${sc.id}`;
        const idx = list.length;
        list.push({
          type: "project",
          label: sc.name,
          path: scPath,
          selectionKey,
          triggers: [sc.trigger],
          shortcutId: sc.id,
          project: project ?? {
            name: sc.name,
            path: scPath,
            isGitRepo: true,
          },
          isShortcut: true,
          isRecent: false,
        });
        keyMap.set(selectionKey, idx);
      }
    }

    // Recent section (only at root level, hidden when searching, respects showRecent setting)
    if (isAtRoot && settings.showRecent && recentEntries.length > 0 && !searchTerm) {
      const recentHeader = list.length;
      let hasRecent = false;
      for (const entry of recentEntries) {
        // Only hide if there's an EXACT shortcut match (single cd command)
        if (exactShortcutPaths.has(entry.path)) continue;
        if (!hasRecent) {
          list.push({ type: "header", label: "Recent" });
          hasRecent = true;
        }
        const project = allProjectsMap.get(entry.path);
        const selectionKey = `recent-${entry.path}`;
        const idx = list.length;
        list.push({
          type: "project",
          label: entry.displayName,
          path: entry.path,
          selectionKey,
          project: project ?? {
            name: basename(entry.path),
            path: entry.path,
            isGitRepo: true,
          },
          isShortcut: false,
          isRecent: true,
        });
        keyMap.set(selectionKey, idx);
      }
    }

    // Current level projects
    const sectionLabel = isAtRoot ? "All Projects" : getDisplayName(currentLevel.parentPath || "", settings.projectsDir);
    list.push({ type: "header", label: sectionLabel });

    for (const project of currentProjects) {
      const triggers = triggersByPath.get(project.path);
      const isSc = triggers && triggers.length > 0;
      const isRec = recentPaths.has(project.path) && !isSc;
      const selectionKey = project.path;  // Main list uses plain path
      const idx = list.length;
      list.push({
        type: "project",
        label: project.name,
        path: project.path,
        selectionKey,
        project,
        isShortcut: isSc,
        isRecent: isRec,
        triggers,
      });
      keyMap.set(selectionKey, idx);
    }

    // Back option at bottom when not at root
    if (!isAtRoot) {
      const idx = list.length;
      list.push({ type: "back", label: "Back", selectionKey: "__back__" });
      keyMap.set("__back__", idx);
    }

    return { unfilteredItems: list, unfilteredKeyToIndex: keyMap };
  }, [currentProjects, recentEntries, shortcutEntries, isAtRoot, recentPaths, exactShortcutPaths, triggersByPath, allProjectsMap, currentLevel.parentPath, settings.projectsDir, settings.showShortcuts, settings.showRecent, searchTerm]);

  // Filter items based on search term, also build keyToIndex map
  const { items, keyToIndex } = useMemo(() => {
    if (!searchTerm) {
      return { items: unfilteredItems, keyToIndex: unfilteredKeyToIndex };
    }

    const lowerSearch = searchTerm.toLowerCase();
    const filtered: ListItem[] = [];
    const keyMap = new Map<string, number>();
    let currentHeader: ListItem | null = null;
    let headerAdded = false;
    let backItem: ListItem | null = null;

    for (const item of unfilteredItems) {
      if (item.type === "header") {
        currentHeader = item;
        headerAdded = false;
      } else if (item.type === "back") {
        backItem = item;
      } else {
        if (item.label.toLowerCase().includes(lowerSearch)) {
          // Add header before first matching item in this section
          if (currentHeader && !headerAdded) {
            filtered.push(currentHeader);
            headerAdded = true;
          }
          const idx = filtered.length;
          filtered.push(item);
          if (item.selectionKey) {
            keyMap.set(item.selectionKey, idx);
          }
        }
      }
    }

    if (backItem) {
      const idx = filtered.length;
      filtered.push(backItem);
      keyMap.set("__back__", idx);
    }

    return { items: filtered, keyToIndex: keyMap };
  }, [unfilteredItems, unfilteredKeyToIndex, searchTerm]);

  // Find selectable indices (not headers)
  const selectableIndices = useMemo(
    () => items
      .map((item, idx) => (item.type !== "header" ? idx : -1))
      .filter((idx) => idx !== -1),
    [items]
  );

  // Selection by key (path) - more stable than index
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Derive selectedIndex from selectedKey using O(1) map lookup
  const selectedIndex = useMemo(() => {
    if (!selectedKey) return selectableIndices[0] ?? 0;
    const idx = keyToIndex.get(selectedKey);
    // If key not found (item removed), fall back to first selectable
    return idx !== undefined ? idx : selectableIndices[0] ?? 0;
  }, [selectedKey, keyToIndex, selectableIndices]);

  // Track previous search term to only reset on actual search changes
  const prevSearchTerm = useRef(searchTerm);

  // When search changes, reset to first item and scroll to top
  useEffect(() => {
    // Only reset if search term actually changed (not on navigation)
    if (searchTerm !== prevSearchTerm.current) {
      prevSearchTerm.current = searchTerm;
      if (selectableIndices.length > 0) {
        setSelectedKey(items[selectableIndices[0]]?.selectionKey ?? null);
        setScrollOffset(0);
      }
    }
  }, [searchTerm, selectableIndices, items]);


  const adjustScroll = (newSelectedIndex: number) => {
    if (newSelectedIndex < scrollOffset) {
      setScrollOffset(newSelectedIndex);
    } else if (newSelectedIndex >= scrollOffset + settings.visibleRows) {
      setScrollOffset(newSelectedIndex - settings.visibleRows + 1);
    }
  };

  const drillDown = (project: Project, fromPath?: string) => {
    if (project.hasNestedProjects) {
      let nestedGitProjects = nestedCache.get(project.path);

      if (!nestedGitProjects) {
        nestedGitProjects = collectNestedGitProjects(project, project.path);
        nestedCache.set(project.path, nestedGitProjects);
      }

      if (nestedGitProjects.length > 0) {
        // Save current scroll/selection state to current level before pushing
        const updatedStack = [...navStack];
        updatedStack[updatedStack.length - 1] = {
          ...currentLevel,
          savedScrollOffset: scrollOffset,
          savedSelectedKey: selectedKey,
        };

        // Push new level and reset scroll/selection atomically
        setNavStack([
          ...updatedStack,
          { projects: nestedGitProjects, parentPath: project.path, savedScrollOffset: 0, savedSelectedKey: null }
        ]);
        setScrollOffset(0);
        setSelectedKey(null); // Reset to first selectable item
        setSearchTerm("");
      }
    }
  };

  const goBack = () => {
    if (navStack.length > 1) {
      const previousLevel = navStack[navStack.length - 2];
      // Restore scroll/selection from previous level atomically
      setNavStack(navStack.slice(0, -1));
      setScrollOffset(previousLevel.savedScrollOffset);
      setSelectedKey(previousLevel.savedSelectedKey);
      setSearchTerm("");
    }
  };

  const handleAddShortcut = () => {
    const currentItem = items[selectedIndex];
    if (currentItem?.type !== "project" || !currentItem.path) return;

    const isInShortcutsSection = currentItem.selectionKey?.startsWith("sc-");
    const isInRecentSection = currentItem.selectionKey?.startsWith("recent-");

    // Don't add from shortcuts section - use Ctrl+D to delete instead
    if (isInShortcutsSection) return;

    // Check if this path already has an exact shortcut - don't add duplicates
    const existingShortcut = findShortcutByPath(currentItem.path);
    if (existingShortcut) return;

    // Add new shortcut
    const displayName = getDisplayName(currentItem.path!, settings.projectsDir);
    const newShortcut = addShortcut({
      name: displayName,
      trigger: generateUniqueTrigger(shortcutEntries),
      caseSensitive: false,
      command: generateCommand(currentItem.path!),
    });
    setShortcutEntries(prev => [...prev, newShortcut]);

    // If adding from Recent section, the item will disappear (exact match)
    // Pre-select the next item to avoid jumping to shortcuts
    if (isInRecentSection) {
      const currentPos = selectableIndices.indexOf(selectedIndex);
      const nextPos = currentPos + 1 < selectableIndices.length ? currentPos + 1 : currentPos - 1;
      if (nextPos >= 0 && nextPos < selectableIndices.length) {
        const nextIndex = selectableIndices[nextPos];
        setSelectedKey(items[nextIndex]?.selectionKey ?? null);
      }
    }
  };

  const handleDeleteShortcut = () => {
    const currentItem = items[selectedIndex];
    if (currentItem?.type !== "project") return;

    // Only allow delete from shortcuts section
    const isInShortcutsSection = currentItem.selectionKey?.startsWith("sc-");
    if (!isInShortcutsSection || !currentItem.shortcutId) return;

    // Show confirmation
    setConfirmDeleteId(currentItem.shortcutId);
  };

  const confirmDelete = () => {
    if (!confirmDeleteId) return;

    removeShortcut(confirmDeleteId);
    setShortcutEntries(prev => prev.filter(s => s.id !== confirmDeleteId));
    setConfirmDeleteId(null);

    // Select next item in list
    const currentPos = selectableIndices.indexOf(selectedIndex);
    const nextPos = currentPos + 1 < selectableIndices.length ? currentPos + 1 : currentPos - 1;
    if (nextPos >= 0 && nextPos < selectableIndices.length) {
      const nextIndex = selectableIndices[nextPos];
      setSelectedKey(items[nextIndex]?.selectionKey ?? null);
    } else {
      setSelectedKey(null);
    }
  };

  const cancelDelete = () => {
    setConfirmDeleteId(null);
  };

  const refreshProjects = () => {
    if (isRefreshing) return; // Already scanning

    setIsRefreshing(true);
    scanAbortSignal.current = { aborted: false };

    scanProjectsAsync(settings, scanAbortSignal.current).then((scanned) => {
      if (!scanAbortSignal.current.aborted) {
        setProjects(scanned);
        setIsRefreshing(false);
        saveCache(scanned, settings.projectsDir, settings.maxDepth, settings.skipDirs);
        // Reset navigation
        setNavStack([{ projects: scanned, parentPath: null, savedScrollOffset: 0, savedSelectedKey: null }]);
        setNestedCache(new Map());
      }
    });
  };

  const handleSettingsSave = (newSettings: Settings) => {
    log("handleSettingsSave: called");
    const needsRescan =
      newSettings.projectsDir !== settings.projectsDir ||
      newSettings.maxDepth !== settings.maxDepth ||
      newSettings.skipDirs !== settings.skipDirs;

    log(`handleSettingsSave: needsRescan=${needsRescan}`);
    log("handleSettingsSave: calling onSettingsSave (sync file write)...");
    setSettings(newSettings);
    onSettingsSave(newSettings);
    log("handleSettingsSave: onSettingsSave done");

    if (needsRescan) {
      // Use async scan to avoid blocking UI
      log("handleSettingsSave: starting async rescan...");
      setIsRefreshing(true);
      scanAbortSignal.current = { aborted: false };

      scanProjectsAsync(newSettings, scanAbortSignal.current).then((newProjects) => {
        log(`handleSettingsSave: async scan complete, ${newProjects.length} projects`);
        if (!scanAbortSignal.current.aborted) {
          setProjects(newProjects);
          // Reset navigation and cache
          setNavStack([{ projects: newProjects, parentPath: null, savedScrollOffset: 0, savedSelectedKey: null }]);
          setNestedCache(new Map());
          setScrollOffset(0);
          setSelectedKey(null);
          setIsRefreshing(false);
          // Update disk cache
          log("handleSettingsSave: saving cache...");
          saveCache(newProjects, newSettings.projectsDir, newSettings.maxDepth, newSettings.skipDirs);
          log("handleSettingsSave: done");
        }
      });
    }
  };

  useInput((input, key) => {
    // Skip input handling when not on projects tab
    if (currentTab !== TAB_PROJECTS) return;

    // Handle delete confirmation mode
    if (confirmDeleteId) {
      if (input === "y" || input === "Y") {
        confirmDelete();
      } else {
        // Any other key cancels (including n, N, Escape, etc.)
        cancelDelete();
      }
      return;
    }

    // Tab - cycle tabs (Shift+Tab for reverse)
    if (key.tab) {
      cycleTab(key.shift);
      return;
    }

    // Ctrl+R (or custom key) - refresh projects list
    if (key.ctrl && input === settings.refreshKey) {
      refreshProjects();
      return;
    }

    // Ctrl+T (or custom key) - add shortcut (from Recent or All Projects only)
    if (key.ctrl && input === settings.shortcutToggleKey) {
      handleAddShortcut();
      return;
    }

    // Ctrl+D - delete shortcut (from Shortcuts section only, with confirmation)
    if (key.ctrl && input === "d") {
      handleDeleteShortcut();
      return;
    }

    // Escape - clear search or go back or exit
    if (key.escape) {
      if (searchTerm) {
        setSearchTerm("");
      } else if (!isAtRoot) {
        goBack();
      } else {
        exit();
      }
      return;
    }

    // Backspace - remove from search or go back
    if (key.backspace || key.delete) {
      if (searchTerm.length > 0) {
        setSearchTerm(searchTerm.slice(0, -1));
      } else if (!isAtRoot) {
        goBack();
      }
      return;
    }

    const currentItem = items[selectedIndex];
    const currentPos = selectableIndices.indexOf(selectedIndex);

    // Enter key - behavior depends on section
    if (key.return) {
      if (currentItem?.type === "back") {
        goBack();
        return;
      }

      if (currentItem?.type === "project") {
        // In shortcuts section: execute the shortcut's stored command
        const isInShortcutsSection = currentItem.selectionKey?.startsWith("sc-");
        if (isInShortcutsSection && currentItem.shortcutId) {
          const shortcut = shortcutEntries.find(s => s.id === currentItem.shortcutId);
          if (shortcut) {
            scanAbortSignal.current.aborted = true;
            writeLastCommand(shortcut.command);
            exit();
            return;
          }
        }

        // In projects/recent list: always just cd to the folder
        if (currentItem.project) {
          scanAbortSignal.current.aborted = true;
          onSelect(currentItem.project.path, getDisplayName(currentItem.project.path, settings.projectsDir));
        }
      }
      return;
    }

    // Right arrow - drill down
    if (key.rightArrow) {
      if (currentItem?.type === "project" && currentItem.project?.hasNestedProjects) {
        drillDown(currentItem.project, currentItem.path);
      }
      return;
    }

    // Left arrow - go back
    if (key.leftArrow) {
      if (!isAtRoot) {
        goBack();
      }
      return;
    }

    // Up arrow (with looping)
    if (key.upArrow) {
      if (selectableIndices.length === 0) return;

      let newPos: number;
      if (currentPos <= 0) {
        // Loop to bottom
        newPos = selectableIndices.length - 1;
        const newIndex = selectableIndices[newPos];
        setSelectedKey(items[newIndex]?.selectionKey ?? null);
        // Scroll to show the item (near bottom)
        setScrollOffset(Math.max(0, items.length - settings.visibleRows));
      } else {
        newPos = currentPos - 1;
        const newIndex = selectableIndices[newPos];
        setSelectedKey(items[newIndex]?.selectionKey ?? null);
        adjustScroll(newIndex);
      }
      return;
    }

    // Down arrow (with looping)
    if (key.downArrow) {
      if (selectableIndices.length === 0) return;

      let newPos: number;
      if (currentPos >= selectableIndices.length - 1) {
        // Loop to top
        newPos = 0;
        const newIndex = selectableIndices[newPos];
        setSelectedKey(items[newIndex]?.selectionKey ?? null);
        // Scroll to top to show headers
        setScrollOffset(0);
      } else {
        newPos = currentPos + 1;
        const newIndex = selectableIndices[newPos];
        setSelectedKey(items[newIndex]?.selectionKey ?? null);
        adjustScroll(newIndex);
      }
      return;
    }

    // Page Up
    if (key.pageUp) {
      if (selectableIndices.length === 0) return;
      const newPos = Math.max(0, currentPos - PAGE_SIZE);
      const newIndex = selectableIndices[newPos];
      setSelectedKey(items[newIndex]?.selectionKey ?? null);
      // If at first item, scroll to top to show headers
      if (newPos === 0) {
        setScrollOffset(0);
      } else {
        adjustScroll(newIndex);
      }
      return;
    }

    // Page Down
    if (key.pageDown) {
      if (selectableIndices.length === 0) return;
      const newPos = Math.min(selectableIndices.length - 1, currentPos + PAGE_SIZE);
      const newIndex = selectableIndices[newPos];
      setSelectedKey(items[newIndex]?.selectionKey ?? null);
      adjustScroll(newIndex);
      return;
    }

    // Regular character input - add to search
    if (input && input.length === 1 && !key.ctrl && !key.meta) {
      if (input.charCodeAt(0) >= 32) {
        setSearchTerm(prev => prev + input);
      }
    }
  });

  // Calculate visible items (clamp scrollOffset to prevent flicker during navigation)
  const maxScroll = Math.max(0, items.length - settings.visibleRows);
  const clampedScrollOffset = Math.min(scrollOffset, maxScroll);
  const visibleItems = items.slice(clampedScrollOffset, clampedScrollOffset + settings.visibleRows);
  const hasMoreAbove = clampedScrollOffset > 0;
  const hasMoreBelow = clampedScrollOffset + settings.visibleRows < items.length;

  // TabBar component with inverted active tab
  const TabBar = () => {
    const tabs = TAB_LABELS.map((label, idx) => {
      const isActive = idx === currentTab;
      return { label, isActive };
    });

    return (
      <Box flexDirection="column" marginTop={1} marginBottom={1} marginLeft={2}>
        <Box>
          {tabs.map((tab, idx) => (
            <React.Fragment key={idx}>
              {tab.isActive ? (
                <Text backgroundColor={settings.selectedColor} color="#333">
                  {tab.label}
                </Text>
              ) : (
                <Text color="gray">{tab.label}</Text>
              )}
              {idx < tabs.length - 1 && <Text dimColor>│</Text>}
            </React.Fragment>
          ))}
        </Box>
      </Box>
    );
  };

  // Handle Shortcuts tab
  if (currentTab === TAB_SHORTCUTS) {
    // Sub-navigation: editing a specific shortcut
    if (editingShortcutId) {
      const shortcut = shortcutEntries.find(s => s.id === editingShortcutId);
      if (shortcut) {
        return (
          <ShortcutEdit
            shortcut={shortcut}
            allShortcuts={shortcutEntries}
            onSave={(updated) => {
              setShortcutEntries(prev =>
                prev.map(s => s.id === updated.id ? updated : s)
              );
            }}
            onBack={() => setEditingShortcutId(null)}
            onTab={cycleTab}
            selectedColor={settings.selectedColor}
            tabBar={<TabBar />}
          />
        );
      }
      // Shortcut not found, go back
      setEditingShortcutId(null);
    }

    return (
      <ShortcutsEditor
        shortcuts={shortcutEntries}
        onUpdate={(updated) => setShortcutEntries(updated)}
        onEditShortcut={(id) => setEditingShortcutId(id)}
        onAddShortcut={() => {
          // Create a new shortcut with defaults
          const newShortcut = addShortcut({
            name: "New Shortcut",
            trigger: generateUniqueTrigger(shortcutEntries),
            caseSensitive: false,
            command: ["cd ~"],
          });
          setShortcutEntries(prev => [...prev, newShortcut]);
          setEditingShortcutId(newShortcut.id);
        }}
        onTab={cycleTab}
        onClose={() => setCurrentTab(TAB_PROJECTS)}
        selectedColor={settings.selectedColor}
        tabBar={<TabBar />}
      />
    );
  }

  // Handle Settings tab
  if (currentTab === TAB_SETTINGS) {
    return (
      <SettingsScreen
        settings={settings}
        onSave={handleSettingsSave}
        onClearShortcuts={() => {
          setShortcutEntries([]);
        }}
        onClearHistory={() => setRecentEntries([])}
        onTab={cycleTab}
        onClose={() => setCurrentTab(TAB_PROJECTS)}
        tabBar={<TabBar />}
      />
    );
  }

  return (
    <Box flexDirection="column">
      {/* Tab bar at top */}
      <TabBar />

      {/* Search input */}
      <Box>
        <Text color="gray">{"  "}</Text>
        <Text color={searchTerm ? "white" : "gray"}>
          {searchTerm || "Type to search..."}
        </Text>
        {searchTerm && <Text color="white">▌</Text>}
      </Box>

      {/* Scrollable list area */}
      {hasMoreAbove && (
        <Box>
          <Text dimColor>  ↑ {scrollOffset} more</Text>
        </Box>
      )}

      {visibleItems.length === 0 && searchTerm && (
        <Box>
          <Text color="yellow">  No matches for "{searchTerm}"</Text>
        </Box>
      )}

      {visibleItems.map((item, visibleIdx) => {
        const actualIdx = clampedScrollOffset + visibleIdx;

        if (item.type === "header") {
          return (
            <Box key={`header-${actualIdx}`}>
              <Text color="gray" dimColor>
                ── {item.label} ──────────────────
              </Text>
            </Box>
          );
        }

        const isSelected = actualIdx === selectedIndex;

        if (item.type === "back") {
          return (
            <Box key="back">
              <Text color={isSelected ? settings.selectedColor : "gray"} bold={isSelected}>
                {"< "}{item.label}
              </Text>
            </Box>
          );
        }

        const project = item.project!;
        const hasNested = !item.isRecent && project.hasNestedProjects;

        let color: string | undefined;
        const isInShortcutsSection = item.selectionKey?.startsWith("sc-");
        if (isSelected) {
          color = settings.selectedColor;
        } else if (isInShortcutsSection) {
          // Only color shortcuts green when in the actual Shortcuts section
          color = settings.shortcutColor;
        } else if (item.isRecent) {
          color = settings.recentColor;
        }
        // Note: projects in All Projects section with triggers show normal text + [trigger] tags

        const isDeleting = item.shortcutId && confirmDeleteId === item.shortcutId;

        return (
          <Box key={`item-${actualIdx}`}>
            <Text color={color} bold={isSelected}>
              {isSelected ? "> " : "  "}
              {item.label}
            </Text>
            {item.triggers && item.triggers.map((t, i) => (
              <Text key={i} dimColor> [{t}]</Text>
            ))}
            {hasNested && (
              <Text color="gray" dimColor> ▶</Text>
            )}
            {isDeleting && (
              <Text color="red"> Delete? (y/n)</Text>
            )}
          </Box>
        );
      })}

      {hasMoreBelow && (
        <Box>
          <Text dimColor>  ↓ {items.length - scrollOffset - settings.visibleRows} more</Text>
        </Box>
      )}

      {isRefreshing && (
        <Box marginTop={1}>
          <Text color="cyan">
            <Spinner type="dots" /> Refreshing...
          </Text>
        </Box>
      )}

      <Box marginTop={isRefreshing ? 0 : 1}>
        <Text dimColor>
          {"  "}tab/shift+tab • ↑↓ select • →← drill • ^{settings.shortcutToggleKey.toUpperCase()} add • ^D del • ^{settings.refreshKey.toUpperCase()} refresh • esc quit
        </Text>
      </Box>
    </Box>
  );
}
