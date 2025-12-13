import React, { useState, useMemo, useEffect, useRef } from "react";
import { Box, Text, useInput, useApp } from "ink";
import Spinner from "ink-spinner";
import type { Project, HistoryEntry, FavoriteEntry, Settings } from "../types.js";
import { basename } from "node:path";
import { SettingsScreen } from "./Settings.js";
import { scanProjectsAsync, ScanAbortSignal } from "../scanner.js";
import { loadCacheAsync, saveCache } from "../cache.js";
import { addFavorite, removeFavorite, isFavorite } from "../history.js";
import { log } from "../logger.js";

const PAGE_SIZE = 10;

interface AppProps {
  initialSettings: Settings;
  recentEntries: HistoryEntry[];
  favoriteEntries: FavoriteEntry[];
  onSelect: (path: string, displayName: string) => void;
  onSettingsSave: (settings: Settings) => void;
}

interface ListItem {
  type: "header" | "project" | "back";
  label: string;
  path?: string;
  project?: Project;
  isFavorite?: boolean;
  isRecent?: boolean;
  favoriteNumber?: number;
}

interface NavLevel {
  projects: Project[];
  parentPath: string | null;
  // Saved scroll/selection state for this level
  savedScrollOffset: number;
  savedSelectedIndex: number;
}

// Get display name for a path (relative to projects dir)
function getDisplayName(path: string, projectsDir: string): string {
  if (path.startsWith(projectsDir)) {
    return path.slice(projectsDir.length + 1).replace(/\\/g, "/");
  }
  return basename(path);
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

export function App({ initialSettings, recentEntries: initialRecentEntries, favoriteEntries: initialFavoriteEntries, onSelect, onSettingsSave }: AppProps) {
  log("App component function called");
  const { exit } = useApp();

  // Screen state
  const [screen, setScreen] = useState<"main" | "settings">("main");

  // Projects and settings state
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [settings, setSettings] = useState(initialSettings);
  const [recentEntries, setRecentEntries] = useState(initialRecentEntries);
  const [favoriteEntries, setFavoriteEntries] = useState(initialFavoriteEntries);

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
    { projects: [], parentPath: null, savedScrollOffset: 0, savedSelectedIndex: 1 }
  ]);

  // Update nav stack when projects finish loading
  useEffect(() => {
    if (projects) {
      setNavStack([{ projects, parentPath: null, savedScrollOffset: 0, savedSelectedIndex: 1 }]);
    }
  }, [projects]);

  const currentLevel = navStack[navStack.length - 1];
  const currentProjects = currentLevel.projects;
  const isAtRoot = navStack.length === 1;

  // Track favorite and recent paths for coloring and filtering
  const favoritePaths = useMemo(
    () => new Set(favoriteEntries.map((e) => e.path)),
    [favoriteEntries]
  );

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

  // Build list with sections (before filtering)
  const unfilteredItems = useMemo(() => {
    const list: ListItem[] = [];

    // Favorites section (only at root level)
    if (isAtRoot && favoriteEntries.length > 0) {
      const validFavoriteItems: ListItem[] = [];
      for (let i = 0; i < favoriteEntries.length; i++) {
        const entry = favoriteEntries[i];
        // Use project data if available, otherwise create minimal entry from path
        const project = allProjectsMap.get(entry.path);
        validFavoriteItems.push({
          type: "project",
          label: entry.displayName,
          path: entry.path,
          favoriteNumber: i + 1,
          project: project ?? {
            name: basename(entry.path),
            path: entry.path,
            isGitRepo: true,
          },
          isFavorite: true,
          isRecent: false,
        });
      }
      if (validFavoriteItems.length > 0) {
        list.push({ type: "header", label: "Favorites" });
        list.push(...validFavoriteItems);
      }
    }

    // Recent section (only at root level) - show immediately from history
    if (isAtRoot && recentEntries.length > 0) {
      const validRecentItems: ListItem[] = [];
      for (const entry of recentEntries) {
        // Skip if already in favorites
        if (favoritePaths.has(entry.path)) continue;

        // Use project data if available, otherwise create minimal entry from path
        const project = allProjectsMap.get(entry.path);
        validRecentItems.push({
          type: "project",
          label: entry.displayName,
          path: entry.path,
          project: project ?? {
            name: basename(entry.path),
            path: entry.path,
            isGitRepo: true,
          },
          isFavorite: false,
          isRecent: true,
        });
      }
      if (validRecentItems.length > 0) {
        list.push({ type: "header", label: "Recent" });
        list.push(...validRecentItems);
      }
    }

    // Current level projects
    const sectionLabel = isAtRoot ? "All Projects" : getDisplayName(currentLevel.parentPath || "", settings.projectsDir);
    list.push({ type: "header", label: sectionLabel });

    for (const project of currentProjects) {
      // Skip if already shown in favorites or recent
      if (isAtRoot && (favoritePaths.has(project.path) || recentPaths.has(project.path))) continue;

      list.push({
        type: "project",
        label: project.name,
        path: project.path,
        project,
        isFavorite: false,
        isRecent: false,
      });
    }

    // Back option at bottom when not at root
    if (!isAtRoot) {
      list.push({ type: "back", label: "Back" });
    }

    return list;
  }, [currentProjects, recentEntries, favoriteEntries, isAtRoot, recentPaths, favoritePaths, allProjectsMap, currentLevel.parentPath, settings.projectsDir]);

  // Filter items based on search term
  const items = useMemo(() => {
    if (!searchTerm) return unfilteredItems;

    const lowerSearch = searchTerm.toLowerCase();
    const filtered: ListItem[] = [];
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
          filtered.push(item);
        }
      }
    }

    if (backItem) {
      filtered.push(backItem);
    }

    return filtered;
  }, [unfilteredItems, searchTerm]);

  // Find selectable indices (not headers)
  const selectableIndices = useMemo(
    () => items
      .map((item, idx) => (item.type !== "header" ? idx : -1))
      .filter((idx) => idx !== -1),
    [items]
  );

  const [selectedIndex, setSelectedIndex] = useState(selectableIndices[0] ?? 0);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Track previous search term to only reset on actual search changes
  const prevSearchTerm = useRef(searchTerm);

  // When search changes, reset to first item and scroll to top
  useEffect(() => {
    // Only reset if search term actually changed (not on navigation)
    if (searchTerm !== prevSearchTerm.current) {
      prevSearchTerm.current = searchTerm;
      if (selectableIndices.length > 0) {
        setSelectedIndex(selectableIndices[0]);
        setScrollOffset(0);
      }
    }
  }, [searchTerm, selectableIndices.length]);


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
          savedSelectedIndex: selectedIndex,
        };

        // Push new level and reset scroll/selection atomically
        setNavStack([
          ...updatedStack,
          { projects: nestedGitProjects, parentPath: project.path, savedScrollOffset: 0, savedSelectedIndex: 1 }
        ]);
        setScrollOffset(0);
        setSelectedIndex(1); // First selectable item (after header)
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
      setSelectedIndex(previousLevel.savedSelectedIndex);
      setSearchTerm("");
    }
  };

  const toggleFavorite = () => {
    const currentItem = items[selectedIndex];
    if (currentItem?.type !== "project" || !currentItem.path) return;

    if (currentItem.isFavorite) {
      // Remove from favorites
      removeFavorite(currentItem.path);
      setFavoriteEntries(prev => prev.filter(f => f.path !== currentItem.path));
    } else {
      // Add to favorites (append to end so first added stays #1)
      addFavorite(currentItem.path, currentItem.label);
      setFavoriteEntries(prev => [
        ...prev,
        { path: currentItem.path!, displayName: currentItem.label, addedAt: Date.now() },
      ]);
    }
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
        setNavStack([{ projects: scanned, parentPath: null, savedScrollOffset: 0, savedSelectedIndex: 1 }]);
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

    // Switch to main screen immediately
    setScreen("main");

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
          setNavStack([{ projects: newProjects, parentPath: null, savedScrollOffset: 0, savedSelectedIndex: 1 }]);
          setNestedCache(new Map());
          setScrollOffset(0);
          setSelectedIndex(1);
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
    // Skip input handling when in settings screen
    if (screen === "settings") return;

    // Tab - open settings
    if (key.tab) {
      setScreen("settings");
      return;
    }

    // Ctrl+R (or custom key) - refresh projects list
    if (key.ctrl && input === settings.refreshKey) {
      refreshProjects();
      return;
    }

    // Ctrl+F (or custom key) - toggle favorite
    if (key.ctrl && input === settings.favoriteKey) {
      toggleFavorite();
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

    // Enter key - select current item
    if (key.return) {
      if (currentItem?.type === "back") {
        goBack();
        return;
      }

      if (currentItem?.type === "project" && currentItem.project) {
        const project = currentItem.project;

        if (project.isGitRepo) {
          // Abort any pending scan to exit immediately
          scanAbortSignal.current.aborted = true;
          onSelect(project.path, currentItem.label);
          return;
        }

        if (project.hasNestedProjects) {
          drillDown(project, currentItem.path);
          return;
        }

        // Abort any pending scan to exit immediately
        scanAbortSignal.current.aborted = true;
        onSelect(project.path, currentItem.label);
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
        setSelectedIndex(newIndex);
        // Scroll to show the item (near bottom)
        setScrollOffset(Math.max(0, items.length - settings.visibleRows));
      } else {
        newPos = currentPos - 1;
        const newIndex = selectableIndices[newPos];
        setSelectedIndex(newIndex);
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
        setSelectedIndex(newIndex);
        // Scroll to top to show headers
        setScrollOffset(0);
      } else {
        newPos = currentPos + 1;
        const newIndex = selectableIndices[newPos];
        setSelectedIndex(newIndex);
        adjustScroll(newIndex);
      }
      return;
    }

    // Page Up
    if (key.pageUp) {
      if (selectableIndices.length === 0) return;
      const newPos = Math.max(0, currentPos - PAGE_SIZE);
      const newIndex = selectableIndices[newPos];
      setSelectedIndex(newIndex);
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
      setSelectedIndex(newIndex);
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

  // Show settings screen
  if (screen === "settings") {
    return (
      <SettingsScreen
        settings={settings}
        onSave={handleSettingsSave}
        onCancel={() => setScreen("main")}
        onClearFavorites={() => setFavoriteEntries([])}
        onClearHistory={() => setRecentEntries([])}
      />
    );
  }

  return (
    <Box flexDirection="column">
      {/* Search input - outside scroll area */}
      <Box marginTop={1}>
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
        if (isSelected) {
          color = settings.selectedColor;
        } else if (item.isFavorite) {
          color = settings.favoriteColor;
        } else if (item.isRecent) {
          color = settings.recentColor;
        }

        return (
          <Box key={item.path}>
            <Text color={color} bold={isSelected}>
              {isSelected ? "> " : "  "}
              {item.label}
            </Text>
            {item.favoriteNumber && (
              <Text dimColor> #{item.favoriteNumber}</Text>
            )}
            {hasNested && (
              <Text color="gray" dimColor> ▶</Text>
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
          ↑↓ navigate • enter select • →← drill/back • ^{settings.favoriteKey.toUpperCase()} fav • tab settings • ^{settings.refreshKey.toUpperCase()} refresh • esc quit
        </Text>
      </Box>
    </Box>
  );
}
