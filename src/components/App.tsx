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
  selectedPath?: string; // Remember which item was selected when we drilled down
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
    // If this is a git repo, add it with relative path as name
    if (p.isGitRepo) {
      results.push({
        ...p,
        name: relativePath,
        // Clear nested info since we're showing a flattened view
        hasNestedProjects: false,
        nestedProjects: undefined,
      });
    }

    // Continue traversing nested projects
    if (p.nestedProjects) {
      for (const nested of p.nestedProjects) {
        const newPath = relativePath ? `${relativePath}/${nested.name}` : nested.name;
        traverse(nested, newPath);
      }
    }
  }

  // Start traversal from children
  if (project.nestedProjects) {
    for (const nested of project.nestedProjects) {
      traverse(nested, nested.name);
    }
  }

  return results;
}

export function App({ projects, recentEntries, onSelect }: AppProps) {
  const { exit } = useApp();

  // Cache for flattened nested projects (computed once per parent path)
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

  // Build list with sections
  const items = useMemo(() => {
    const list: ListItem[] = [];

    // Back option when not at root
    if (!isAtRoot) {
      list.push({ type: "back", label: "← Back" });
    }

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
      // Skip if already shown in recent (only at root)
      if (isAtRoot && recentPaths.has(project.path)) continue;

      list.push({
        type: "project",
        label: project.name,
        path: project.path,
        project,
        isRecent: false,
      });
    }

    return list;
  }, [currentProjects, recentEntries, isAtRoot, recentPaths, allProjectsMap, currentLevel.parentPath]);

  // Find selectable indices (not headers)
  const selectableIndices = useMemo(
    () => items
      .map((item, idx) => (item.type !== "header" ? idx : -1))
      .filter((idx) => idx !== -1),
    [items]
  );

  const [selectedIndex, setSelectedIndex] = useState(selectableIndices[0] ?? 0);
  const [scrollOffset, setScrollOffset] = useState(0);

  // When nav stack changes, restore selection or reset
  useEffect(() => {
    const restoredPath = currentLevel.selectedPath;
    if (restoredPath) {
      // Going back - find the index of the item we came from
      const itemIndex = items.findIndex(item => item.path === restoredPath);
      if (itemIndex !== -1) {
        setSelectedIndex(itemIndex);
        // Adjust scroll to show selected item
        if (itemIndex < scrollOffset) {
          setScrollOffset(itemIndex);
        } else if (itemIndex >= scrollOffset + VISIBLE_COUNT) {
          setScrollOffset(Math.max(0, itemIndex - VISIBLE_COUNT + 1));
        }
        return;
      }
    }
    // Drilling down or initial - select first project (skip back option)
    const firstProjectIndex = items.findIndex(item => item.type === "project");
    if (firstProjectIndex !== -1) {
      setSelectedIndex(firstProjectIndex);
      setScrollOffset(0);
    } else {
      setSelectedIndex(selectableIndices[0] ?? 0);
      setScrollOffset(0);
    }
  }, [navStack.length]); // Only trigger on navigation changes

  // Adjust scroll when selection changes
  const adjustScroll = (newSelectedIndex: number) => {
    if (newSelectedIndex < scrollOffset) {
      setScrollOffset(newSelectedIndex);
    } else if (newSelectedIndex >= scrollOffset + VISIBLE_COUNT) {
      setScrollOffset(newSelectedIndex - VISIBLE_COUNT + 1);
    }
  };

  // Navigate into a project's nested projects
  const drillDown = (project: Project, fromPath?: string) => {
    if (project.hasNestedProjects) {
      // Check cache first
      let nestedGitProjects = nestedCache.get(project.path);

      if (!nestedGitProjects) {
        // Collect all nested git projects (flattened) and cache
        nestedGitProjects = collectNestedGitProjects(project, project.path);
        nestedCache.set(project.path, nestedGitProjects);
      }

      if (nestedGitProjects.length > 0) {
        // Update current level to remember which item was selected
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

  // Navigate back
  const goBack = () => {
    if (navStack.length > 1) {
      setNavStack(navStack.slice(0, -1));
    }
  };

  useInput((input, key) => {
    if (key.escape || input === "q") {
      exit();
      return;
    }

    const currentItem = items[selectedIndex];
    const currentPos = selectableIndices.indexOf(selectedIndex);

    // Enter key
    if (key.return) {
      if (currentItem?.type === "back") {
        goBack();
        return;
      }

      if (currentItem?.type === "project" && currentItem.project) {
        const project = currentItem.project;

        // If it's a git repo, select it
        if (project.isGitRepo) {
          onSelect(project.path);
          return;
        }

        // If not a git repo but has nested projects, drill down
        if (project.hasNestedProjects) {
          drillDown(project, currentItem.path);
          return;
        }

        // Otherwise just select it (folder with no git)
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
      goBack();
      return;
    }

    // Up arrow (with looping)
    if (key.upArrow) {
      let newPos: number;
      if (currentPos <= 0) {
        // Loop to bottom
        newPos = selectableIndices.length - 1;
      } else {
        newPos = currentPos - 1;
      }
      const newIndex = selectableIndices[newPos];
      setSelectedIndex(newIndex);
      adjustScroll(newIndex);
      return;
    }

    // Down arrow (with looping)
    if (key.downArrow) {
      let newPos: number;
      if (currentPos >= selectableIndices.length - 1) {
        // Loop to top
        newPos = 0;
      } else {
        newPos = currentPos + 1;
      }
      const newIndex = selectableIndices[newPos];
      setSelectedIndex(newIndex);
      adjustScroll(newIndex);
      return;
    }

    // Home key - go to first item
    if (input === "g" || (key.meta && key.leftArrow)) {
      const newIndex = selectableIndices[0];
      if (newIndex !== undefined) {
        setSelectedIndex(newIndex);
        setScrollOffset(0);
      }
      return;
    }

    // End key - go to last item
    if (input === "G" || (key.meta && key.rightArrow)) {
      const newIndex = selectableIndices[selectableIndices.length - 1];
      if (newIndex !== undefined) {
        setSelectedIndex(newIndex);
        setScrollOffset(Math.max(0, items.length - VISIBLE_COUNT));
      }
      return;
    }

    // Page Up
    if (key.pageUp || input === "u") {
      const newPos = Math.max(0, currentPos - PAGE_SIZE);
      const newIndex = selectableIndices[newPos];
      setSelectedIndex(newIndex);
      adjustScroll(newIndex);
      return;
    }

    // Page Down
    if (key.pageDown || input === "d") {
      const newPos = Math.min(selectableIndices.length - 1, currentPos + PAGE_SIZE);
      const newIndex = selectableIndices[newPos];
      setSelectedIndex(newIndex);
      adjustScroll(newIndex);
      return;
    }
  });

  if (items.length === 0) {
    return (
      <Box>
        <Text color="yellow">No projects found in D:\projects</Text>
      </Box>
    );
  }

  // Calculate visible items
  const visibleItems = items.slice(scrollOffset, scrollOffset + VISIBLE_COUNT);
  const hasMoreAbove = scrollOffset > 0;
  const hasMoreBelow = scrollOffset + VISIBLE_COUNT < items.length;

  return (
    <Box flexDirection="column">
      {hasMoreAbove && (
        <Box>
          <Text dimColor>  ↑ {scrollOffset} more</Text>
        </Box>
      )}

      {visibleItems.map((item, visibleIdx) => {
        const actualIdx = scrollOffset + visibleIdx;

        // Header
        if (item.type === "header") {
          const showMargin = visibleIdx > 0;
          return (
            <Box key={`header-${actualIdx}`} marginTop={showMargin ? 1 : 0}>
              <Text color="gray" dimColor>
                ── {item.label} ──────────────────
              </Text>
            </Box>
          );
        }

        const isSelected = actualIdx === selectedIndex;

        // Back button
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

        // Project item
        const project = item.project!;
        // Don't show drill arrow for recent items (they're direct selections)
        const hasNested = !item.isRecent && project.hasNestedProjects;

        // Color priority: selected (yellow) > recent (blue) > default (white)
        let color: string | undefined;
        if (isSelected) {
          color = "#FFD700"; // gold
        } else if (item.isRecent) {
          color = "#6495ED"; // cornflower blue
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
          ↑↓ navigate • enter select • →← drill/back • g/G top/bottom • u/d page • q quit
        </Text>
      </Box>
    </Box>
  );
}
