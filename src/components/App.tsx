import React, { useState, useMemo, useEffect } from "react";
import { Box, Text, useInput, useApp } from "ink";
import type { Project, HistoryEntry, Settings } from "../types.js";
import { basename } from "node:path";
import { SettingsScreen } from "./Settings.js";
import { scanProjects } from "../scanner.js";

const PAGE_SIZE = 10;

interface AppProps {
  initialProjects: Project[];
  initialSettings: Settings;
  recentEntries: HistoryEntry[];
  onSelect: (path: string) => void;
  onSettingsSave: (settings: Settings) => void;
}

interface ListItem {
  type: "header" | "project" | "back";
  label: string;
  path?: string;
  project?: Project;
  isRecent?: boolean;
}

interface NavLevel {
  projects: Project[];
  parentPath: string | null;
  selectedPath?: string;
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

export function App({ initialProjects, initialSettings, recentEntries, onSelect, onSettingsSave }: AppProps) {
  const { exit } = useApp();

  // Screen state
  const [screen, setScreen] = useState<"main" | "settings">("main");

  // Projects and settings state (lifted from props for rescan support)
  const [projects, setProjects] = useState(initialProjects);
  const [settings, setSettings] = useState(initialSettings);

  // Search state - just the term, no focus state
  const [searchTerm, setSearchTerm] = useState("");

  // Cache for flattened nested projects
  const [nestedCache, setNestedCache] = useState<Map<string, Project[]>>(() => new Map());

  // Navigation stack
  const [navStack, setNavStack] = useState<NavLevel[]>([
    { projects, parentPath: null }
  ]);

  const currentLevel = navStack[navStack.length - 1];
  const currentProjects = currentLevel.projects;
  const isAtRoot = navStack.length === 1;

  // Track recent paths for coloring
  const recentPaths = useMemo(
    () => new Set(recentEntries.map((e) => e.path)),
    [recentEntries]
  );

  // Build flat map of all projects for recent lookup
  const allProjectsMap = useMemo(() => {
    const map = new Map<string, Project>();
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

    // Recent section (only at root level)
    if (isAtRoot && recentEntries.length > 0) {
      list.push({ type: "header", label: "Recent" });
      for (const entry of recentEntries) {
        const project = allProjectsMap.get(entry.path);
        if (project) {
          list.push({
            type: "project",
            label: getDisplayName(project.path, settings.projectsDir),
            path: project.path,
            project,
            isRecent: true,
          });
        }
      }
    }

    // Current level projects
    const sectionLabel = isAtRoot ? "All Projects" : getDisplayName(currentLevel.parentPath || "", settings.projectsDir);
    list.push({ type: "header", label: sectionLabel });

    for (const project of currentProjects) {
      if (isAtRoot && recentPaths.has(project.path)) continue;

      list.push({
        type: "project",
        label: project.name,
        path: project.path,
        project,
        isRecent: false,
      });
    }

    // Back option at bottom when not at root
    if (!isAtRoot) {
      list.push({ type: "back", label: "← Back" });
    }

    return list;
  }, [currentProjects, recentEntries, isAtRoot, recentPaths, allProjectsMap, currentLevel.parentPath, settings.projectsDir]);

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

  // When search changes, reset to first item and scroll to top
  useEffect(() => {
    if (selectableIndices.length > 0) {
      setSelectedIndex(selectableIndices[0]);
      setScrollOffset(0);
    }
  }, [searchTerm, selectableIndices.length]);

  // When nav stack changes, restore selection or reset
  useEffect(() => {
    const restoredPath = currentLevel.selectedPath;
    if (restoredPath) {
      const itemIndex = items.findIndex(item => item.path === restoredPath);
      if (itemIndex !== -1) {
        setSelectedIndex(itemIndex);
        if (itemIndex < scrollOffset) {
          setScrollOffset(itemIndex);
        } else if (itemIndex >= scrollOffset + settings.visibleRows) {
          setScrollOffset(Math.max(0, itemIndex - settings.visibleRows + 1));
        }
        return;
      }
    }
    // Reset
    setSearchTerm("");
    if (selectableIndices.length > 0) {
      setSelectedIndex(selectableIndices[0]);
    }
    setScrollOffset(0);
  }, [navStack.length]);

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
        const updatedStack = [...navStack];
        updatedStack[updatedStack.length - 1] = {
          ...currentLevel,
          selectedPath: fromPath || project.path,
        };

        setNavStack([
          ...updatedStack,
          { projects: nestedGitProjects, parentPath: project.path }
        ]);
      }
    }
  };

  const goBack = () => {
    if (navStack.length > 1) {
      setNavStack(navStack.slice(0, -1));
    }
  };

  const handleSettingsSave = (newSettings: Settings) => {
    const needsRescan =
      newSettings.projectsDir !== settings.projectsDir ||
      newSettings.maxDepth !== settings.maxDepth ||
      newSettings.skipDirs !== settings.skipDirs;

    setSettings(newSettings);
    onSettingsSave(newSettings);

    if (needsRescan) {
      const newProjects = scanProjects(newSettings);
      setProjects(newProjects);
      // Reset navigation and cache
      setNavStack([{ projects: newProjects, parentPath: null }]);
      setNestedCache(new Map());
    }

    setScreen("main");
  };

  useInput((input, key) => {
    // Skip input handling when in settings screen
    if (screen === "settings") return;

    // Tab - open settings
    if (key.tab) {
      setScreen("settings");
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
          onSelect(project.path);
          return;
        }

        if (project.hasNestedProjects) {
          drillDown(project, currentItem.path);
          return;
        }

        onSelect(project.path);
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
      adjustScroll(newIndex);
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

  // Calculate visible items
  const visibleItems = items.slice(scrollOffset, scrollOffset + settings.visibleRows);
  const hasMoreAbove = scrollOffset > 0;
  const hasMoreBelow = scrollOffset + settings.visibleRows < items.length;

  // Show settings screen
  if (screen === "settings") {
    return (
      <SettingsScreen
        settings={settings}
        onSave={handleSettingsSave}
        onCancel={() => setScreen("main")}
      />
    );
  }

  return (
    <Box flexDirection="column">
      {/* Search input - outside scroll area */}
      <Box marginBottom={1}>
        <Text color="gray">{"  "}</Text>
        <Text color={searchTerm ? settings.selectedColor : "gray"}>
          {searchTerm || "Type to search..."}
        </Text>
        {searchTerm && <Text color={settings.selectedColor}>▌</Text>}
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
        const actualIdx = scrollOffset + visibleIdx;

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
                {isSelected ? "> " : "  "}
                {item.label}
              </Text>
            </Box>
          );
        }

        const project = item.project!;
        const hasNested = !item.isRecent && project.hasNestedProjects;

        let color: string | undefined;
        if (isSelected) {
          color = settings.selectedColor;
        } else if (item.isRecent) {
          color = settings.recentColor;
        }

        return (
          <Box key={item.path}>
            <Text color={color} bold={isSelected}>
              {isSelected ? "> " : "  "}
              {item.label}
            </Text>
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

      <Box marginTop={1}>
        <Text dimColor>
          type to filter • ↑↓ navigate • enter select • →← drill/back • tab settings • esc quit
        </Text>
      </Box>
    </Box>
  );
}
