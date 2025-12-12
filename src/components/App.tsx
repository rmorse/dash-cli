import React, { useState, useMemo } from "react";
import { Box, Text, useInput, useApp } from "ink";
import type { Project, HistoryEntry } from "../types.js";

const VISIBLE_COUNT = 12;

interface AppProps {
  projects: Project[];
  recentEntries: HistoryEntry[];
  onSelect: (path: string) => void;
}

interface ListItem {
  type: "header" | "project";
  label: string;
  path?: string;
}

export function App({ projects, recentEntries, onSelect }: AppProps) {
  const { exit } = useApp();

  // Track recent paths for coloring
  const recentPaths = useMemo(
    () => new Set(recentEntries.map((e) => e.path)),
    [recentEntries]
  );

  // Build list with sections
  const items = useMemo(() => {
    const list: ListItem[] = [];

    // Recent section
    if (recentEntries.length > 0) {
      list.push({ type: "header", label: "Recent" });
      for (const entry of recentEntries) {
        const project = projects.find((p) => p.path === entry.path);
        if (project) {
          list.push({ type: "project", label: project.name, path: project.path });
        }
      }
    }

    // All projects section
    const otherProjects = projects.filter((p) => !recentPaths.has(p.path));
    if (otherProjects.length > 0) {
      list.push({ type: "header", label: "All Projects" });
      for (const project of otherProjects) {
        list.push({ type: "project", label: project.name, path: project.path });
      }
    }

    return list;
  }, [projects, recentEntries, recentPaths]);

  // Find selectable indices
  const selectableIndices = useMemo(
    () => items
      .map((item, idx) => (item.type === "project" ? idx : -1))
      .filter((idx) => idx !== -1),
    [items]
  );

  const [selectedIndex, setSelectedIndex] = useState(selectableIndices[0] ?? 0);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Adjust scroll when selection changes
  const adjustScroll = (newSelectedIndex: number) => {
    // Ensure selected item is visible
    if (newSelectedIndex < scrollOffset) {
      setScrollOffset(newSelectedIndex);
    } else if (newSelectedIndex >= scrollOffset + VISIBLE_COUNT) {
      setScrollOffset(newSelectedIndex - VISIBLE_COUNT + 1);
    }
  };

  useInput((input, key) => {
    if (key.escape || input === "q") {
      exit();
      return;
    }

    if (key.return) {
      const item = items[selectedIndex];
      if (item?.type === "project" && item.path) {
        onSelect(item.path);
      }
      return;
    }

    if (key.upArrow) {
      const currentPos = selectableIndices.indexOf(selectedIndex);
      if (currentPos > 0) {
        const newIndex = selectableIndices[currentPos - 1];
        setSelectedIndex(newIndex);
        adjustScroll(newIndex);
      }
      return;
    }

    if (key.downArrow) {
      const currentPos = selectableIndices.indexOf(selectedIndex);
      if (currentPos < selectableIndices.length - 1) {
        const newIndex = selectableIndices[currentPos + 1];
        setSelectedIndex(newIndex);
        adjustScroll(newIndex);
      }
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

        if (item.type === "header") {
          // Only add margin if not first visible item
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
        const isRecent = recentPaths.has(item.path!);

        // Color priority: selected (yellow) > recent (blue) > default (white)
        let color: string | undefined;
        if (isSelected) {
          color = "#FFD700"; // gold
        } else if (isRecent) {
          color = "#6495ED"; // cornflower blue
        }

        return (
          <Box key={item.path}>
            <Text color={color} bold={isSelected} inverse={isSelected}>
              {isSelected ? "> " : "  "}
              {item.label}
            </Text>
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
          ↑↓ navigate • enter select • q quit
        </Text>
      </Box>
    </Box>
  );
}
