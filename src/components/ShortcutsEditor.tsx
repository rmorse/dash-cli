import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { Shortcut } from "../types.js";
import { removeShortcut } from "../shortcuts.js";
import { Breadcrumb } from "./Breadcrumb.js";

interface ShortcutsEditorProps {
  shortcuts: Shortcut[];
  onUpdate: (shortcuts: Shortcut[]) => void;
  onEditShortcut: (id: string) => void;
  onAddShortcut: () => void;
  onBack: () => void;
  breadcrumbs: string[];
}

export function ShortcutsEditor({
  shortcuts,
  onUpdate,
  onEditShortcut,
  onAddShortcut,
  onBack,
  breadcrumbs,
}: ShortcutsEditorProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Items: shortcuts + "Add new shortcut" action
  const totalItems = shortcuts.length + 1;
  const isOnAddNew = selectedIndex === shortcuts.length;

  useInput((input, key) => {
    // Handle delete confirmation
    if (confirmDelete) {
      if (input === "y" || input === "Y") {
        removeShortcut(confirmDelete);
        onUpdate(shortcuts.filter((s) => s.id !== confirmDelete));
        setConfirmDelete(null);
        // Adjust selection if needed
        if (selectedIndex >= shortcuts.length - 1) {
          setSelectedIndex(Math.max(0, shortcuts.length - 2));
        }
      } else if (input === "n" || input === "N" || key.escape) {
        setConfirmDelete(null);
      }
      return;
    }

    // Navigation
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
      return;
    }

    // Enter - edit or add
    if (key.return) {
      if (isOnAddNew) {
        onAddShortcut();
      } else {
        onEditShortcut(shortcuts[selectedIndex].id);
      }
      return;
    }

    // Ctrl+D - delete shortcut
    if (key.ctrl && input === "d") {
      if (!isOnAddNew && shortcuts.length > 0) {
        setConfirmDelete(shortcuts[selectedIndex].id);
      }
      return;
    }

    // Escape or Tab - go back
    if (key.escape || key.tab) {
      onBack();
      return;
    }
  });

  return (
    <Box flexDirection="column" marginTop={1}>
      <Breadcrumb items={breadcrumbs} />

      <Box>
        <Text color="gray" dimColor>
          ── Shortcuts ──────────────────
        </Text>
      </Box>

      {shortcuts.length === 0 && (
        <Box>
          <Text color="gray" dimColor>
            {"  "}No shortcuts yet
          </Text>
        </Box>
      )}

      {shortcuts.map((sc, idx) => {
        const isSelected = idx === selectedIndex;
        const isDeleting = confirmDelete === sc.id;

        return (
          <Box key={sc.id}>
            <Text color={isSelected ? "#FFD700" : undefined} bold={isSelected}>
              {isSelected ? "> " : "  "}
              {sc.name}
            </Text>
            <Text dimColor> [{sc.trigger}]</Text>
            {isDeleting && (
              <Text color="red"> Delete? (y/n)</Text>
            )}
          </Box>
        );
      })}

      <Box>
        <Text
          color={isOnAddNew ? "#FFD700" : "cyan"}
          bold={isOnAddNew}
        >
          {isOnAddNew ? "> " : "  "}[Add new shortcut]
        </Text>
      </Box>

      <Box>
        <Text color="gray" dimColor>
          ────────────────────────────────
        </Text>
      </Box>
      <Box>
        <Text dimColor>
          enter edit {shortcuts.length > 0 ? "• ^D delete " : ""}• esc/tab back
        </Text>
      </Box>
    </Box>
  );
}
