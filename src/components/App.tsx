import React, { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";
import type { Project, HistoryEntry } from "../types.js";

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

  // Build list with sections
  const items: ListItem[] = [];
  const recentPaths = new Set(recentEntries.map((e) => e.path));

  // Recent section
  if (recentEntries.length > 0) {
    items.push({ type: "header", label: "Recent" });
    for (const entry of recentEntries) {
      const project = projects.find((p) => p.path === entry.path);
      if (project) {
        items.push({ type: "project", label: project.name, path: project.path });
      }
    }
  }

  // All projects section
  const otherProjects = projects.filter((p) => !recentPaths.has(p.path));
  if (otherProjects.length > 0) {
    items.push({ type: "header", label: "All Projects" });
    for (const project of otherProjects) {
      items.push({ type: "project", label: project.name, path: project.path });
    }
  }

  // Find first selectable index
  const selectableIndices = items
    .map((item, idx) => (item.type === "project" ? idx : -1))
    .filter((idx) => idx !== -1);

  const [selectedIndex, setSelectedIndex] = useState(selectableIndices[0] ?? 0);

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
        setSelectedIndex(selectableIndices[currentPos - 1]);
      }
      return;
    }

    if (key.downArrow) {
      const currentPos = selectableIndices.indexOf(selectedIndex);
      if (currentPos < selectableIndices.length - 1) {
        setSelectedIndex(selectableIndices[currentPos + 1]);
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

  return (
    <Box flexDirection="column">
      {items.map((item, idx) => {
        if (item.type === "header") {
          return (
            <Box key={`header-${idx}`} marginTop={idx > 0 ? 1 : 0}>
              <Text color="gray" dimColor>
                ── {item.label} ──────────────────
              </Text>
            </Box>
          );
        }

        const isSelected = idx === selectedIndex;
        return (
          <Box key={item.path}>
            <Text color={isSelected ? "cyan" : undefined}>
              {isSelected ? "> " : "  "}
              {item.label}
            </Text>
          </Box>
        );
      })}
      <Box marginTop={1}>
        <Text dimColor>
          ↑↓ navigate • enter select • q quit
        </Text>
      </Box>
    </Box>
  );
}
