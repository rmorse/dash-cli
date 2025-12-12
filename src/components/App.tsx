import React, { useState, useMemo, useEffect } from "react";
import { Box, Text, useInput, useApp } from "ink";
import type { Project, HistoryEntry } from "../types.js";
import { basename } from "node:path";

const VISIBLE_COUNT = 12;
const PAGE_SIZE = 10;
const PROJECTS_DIR = "D:\\projects";

interface AppProps {
  projects: Project[];
  recentEntries: HistoryEntry[];
  onSelect: (path: string) => void;
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
function getDisplayName(path: string): string {
  if (path.startsWith(PROJECTS_DIR)) {
    return path.slice(PROJECTS_DIR.length + 1).replace(/\\/g, "/");
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

export function App({ projects, recentEntries, onSelect }: AppProps) {
  const { exit } = useApp();

  // Search state
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(true); // Start focused on search

  // Cache for flattened nested projects
  const [nestedCache] = useState<Map<string, Project[]>>(() => new Map());

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
            label: getDisplayName(project.path),
            path: project.path,
            project,
            isRecent: true,
          });
        }
      }
    }

    // Current level projects
    const sectionLabel = isAtRoot ? "All Projects" : getDisplayName(currentLevel.parentPath || "");
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
  }, [currentProjects, recentEntries, isAtRoot, recentPaths, allProjectsMap, currentLevel.parentPath]);

  // Filter items based on search term
  const items = useMemo(() => {
    if (!searchTerm) return unfilteredItems;

    const lowerSearch = searchTerm.toLowerCase();
    const filtered: ListItem[] = [];
    let currentHeader: ListItem | null = null;
    let headerHasItems = false;
    let backItem: ListItem | null = null;

    for (const item of unfilteredItems) {
      if (item.type === "header") {
        // Add previous header if it had items
        if (currentHeader && headerHasItems) {
          filtered.push(currentHeader);
        }
        currentHeader = item;
        headerHasItems = false;
      } else if (item.type === "back") {
        // Save back option to add at end
        backItem = item;
      } else {
        // Filter projects by search term
        if (item.label.toLowerCase().includes(lowerSearch)) {
          if (currentHeader && !headerHasItems) {
            filtered.push(currentHeader);
            headerHasItems = true;
          }
          filtered.push(item);
        }
      }
    }

    // Add back option at end
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

  // When search changes, reset selection to first item
  useEffect(() => {
    if (searchTerm && selectableIndices.length > 0) {
      setSelectedIndex(selectableIndices[0]);
      setScrollOffset(0);
    }
  }, [searchTerm]);

  // When nav stack changes, restore selection or reset
  useEffect(() => {
    const restoredPath = currentLevel.selectedPath;
    if (restoredPath) {
      const itemIndex = items.findIndex(item => item.path === restoredPath);
      if (itemIndex !== -1) {
        setSelectedIndex(itemIndex);
        setIsSearchFocused(false);
        if (itemIndex < scrollOffset) {
          setScrollOffset(itemIndex);
        } else if (itemIndex >= scrollOffset + VISIBLE_COUNT) {
          setScrollOffset(Math.max(0, itemIndex - VISIBLE_COUNT + 1));
        }
        return;
      }
    }
    // Reset to search focused
    setSearchTerm("");
    setIsSearchFocused(true);
    setScrollOffset(0);
  }, [navStack.length]);

  const adjustScroll = (newSelectedIndex: number) => {
    if (newSelectedIndex < scrollOffset) {
      setScrollOffset(newSelectedIndex);
    } else if (newSelectedIndex >= scrollOffset + VISIBLE_COUNT) {
      setScrollOffset(newSelectedIndex - VISIBLE_COUNT + 1);
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

  useInput((input, key) => {
    // Escape key
    if (key.escape) {
      if (isSearchFocused) {
        if (searchTerm) {
          // Clear search
          setSearchTerm("");
        } else if (!isAtRoot) {
          // Go back if search empty
          goBack();
        } else {
          exit();
        }
      } else {
        // On list - go back to top and clear
        setSearchTerm("");
        setIsSearchFocused(true);
        setScrollOffset(0);
      }
      return;
    }

    if (input === "q" && !isSearchFocused) {
      exit();
      return;
    }

    // Backspace - remove from search
    if (key.backspace || key.delete) {
      if (searchTerm.length > 0) {
        setSearchTerm(searchTerm.slice(0, -1));
        setIsSearchFocused(true);
      } else if (!isAtRoot) {
        goBack();
      }
      return;
    }

    const currentItem = items[selectedIndex];
    const currentPos = selectableIndices.indexOf(selectedIndex);

    // Enter key
    if (key.return) {
      if (isSearchFocused && selectableIndices.length > 0) {
        // Move to first item
        setIsSearchFocused(false);
        setSelectedIndex(selectableIndices[0]);
        return;
      }

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
    if (key.rightArrow && !isSearchFocused) {
      if (currentItem?.type === "project" && currentItem.project?.hasNestedProjects) {
        drillDown(currentItem.project, currentItem.path);
      }
      return;
    }

    // Left arrow - go back (also when search focused and empty)
    if (key.leftArrow) {
      if (isSearchFocused && !searchTerm && !isAtRoot) {
        goBack();
        return;
      }
      if (!isSearchFocused) {
        goBack();
      }
      return;
    }

    // Up arrow
    if (key.upArrow) {
      if (isSearchFocused) {
        // Loop to bottom
        if (selectableIndices.length > 0) {
          const lastIndex = selectableIndices[selectableIndices.length - 1];
          setSelectedIndex(lastIndex);
          setIsSearchFocused(false);
          adjustScroll(lastIndex);
        }
        return;
      }

      if (currentPos <= 0) {
        // Go back to search
        setIsSearchFocused(true);
      } else {
        const newIndex = selectableIndices[currentPos - 1];
        setSelectedIndex(newIndex);
        adjustScroll(newIndex);
      }
      return;
    }

    // Down arrow
    if (key.downArrow) {
      if (isSearchFocused) {
        // Move to first item
        if (selectableIndices.length > 0) {
          setSelectedIndex(selectableIndices[0]);
          setIsSearchFocused(false);
          adjustScroll(selectableIndices[0]);
        }
        return;
      }

      if (currentPos >= selectableIndices.length - 1) {
        // Loop to search
        setIsSearchFocused(true);
        setScrollOffset(0);
      } else {
        const newIndex = selectableIndices[currentPos + 1];
        setSelectedIndex(newIndex);
        adjustScroll(newIndex);
      }
      return;
    }

    // Page Up
    if (key.pageUp) {
      if (isSearchFocused) return;
      const newPos = Math.max(0, currentPos - PAGE_SIZE);
      const newIndex = selectableIndices[newPos];
      setSelectedIndex(newIndex);
      adjustScroll(newIndex);
      return;
    }

    // Page Down
    if (key.pageDown) {
      if (isSearchFocused) return;
      const newPos = Math.min(selectableIndices.length - 1, currentPos + PAGE_SIZE);
      const newIndex = selectableIndices[newPos];
      setSelectedIndex(newIndex);
      adjustScroll(newIndex);
      return;
    }

    // Regular character input - add to search
    if (input && input.length === 1 && !key.ctrl && !key.meta) {
      // Only allow printable characters
      if (input.charCodeAt(0) >= 32) {
        setSearchTerm(prev => prev + input);
        setIsSearchFocused(true);
      }
    }
  });

  // Calculate visible items
  const visibleItems = items.slice(scrollOffset, scrollOffset + VISIBLE_COUNT);
  const hasMoreAbove = scrollOffset > 0;
  const hasMoreBelow = scrollOffset + VISIBLE_COUNT < items.length;

  return (
    <Box flexDirection="column">
      {/* Search input */}
      <Box marginBottom={1}>
        <Text color={isSearchFocused ? "#FFD700" : "gray"} bold={isSearchFocused}>
          {isSearchFocused ? "> " : "  "}
        </Text>
        <Text color={isSearchFocused ? "#FFD700" : "white"}>
          {searchTerm || (isSearchFocused ? "" : "Type to search...")}
        </Text>
        {isSearchFocused && <Text color="#FFD700">▌</Text>}
      </Box>

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

        const isSelected = !isSearchFocused && actualIdx === selectedIndex;

        if (item.type === "back") {
          return (
            <Box key="back">
              <Text color={isSelected ? "#FFD700" : "gray"} bold={isSelected}>
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
          color = "#FFD700";
        } else if (item.isRecent) {
          color = "#6495ED";
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
          <Text dimColor>  ↓ {items.length - scrollOffset - VISIBLE_COUNT} more</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>
          type to search • ↑↓ navigate • enter select • →← drill/back • esc clear • q quit
        </Text>
      </Box>
    </Box>
  );
}
