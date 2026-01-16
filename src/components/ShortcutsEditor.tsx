import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { Shortcut, Settings } from "../types.js";
import { removeShortcut, clearShortcuts, moveShortcut } from "../shortcuts.js";

interface ShortcutsEditorProps {
  shortcuts: Shortcut[];
  onUpdate: (shortcuts: Shortcut[]) => void;
  onEditShortcut: (id: string) => void;
  onAddShortcut: () => void;
  onTab: (reverse?: boolean) => void;
  onClose: () => void;
  selectedColor: string;
  tabBar: React.ReactNode;
  settings: Settings;
}

interface MoveMode {
  shortcutId: string;
  originalIndex: number;
  currentIndex: number;
}

export function ShortcutsEditor({
  shortcuts,
  onUpdate,
  onEditShortcut,
  onAddShortcut,
  onTab,
  onClose,
  selectedColor,
  tabBar,
  settings,
}: ShortcutsEditorProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [moveMode, setMoveMode] = useState<MoveMode | null>(null);

  // Items: shortcuts + "Add new shortcut" + "Clear all" (if shortcuts exist)
  const hasClearAll = shortcuts.length > 0;
  const totalItems = shortcuts.length + 1 + (hasClearAll ? 1 : 0);
  const addNewIndex = shortcuts.length;
  const clearAllIndex = shortcuts.length + 1;
  const isOnAddNew = selectedIndex === addNewIndex;
  const isOnClearAll = hasClearAll && selectedIndex === clearAllIndex;

  useInput((input, key) => {
    // Handle move mode
    if (moveMode) {
      if (key.upArrow) {
        setMoveMode((prev) => {
          if (!prev) return null;
          const newIndex = Math.max(0, prev.currentIndex - 1);
          return { ...prev, currentIndex: newIndex };
        });
        return;
      }

      if (key.downArrow) {
        setMoveMode((prev) => {
          if (!prev) return null;
          const newIndex = Math.min(shortcuts.length - 1, prev.currentIndex + 1);
          return { ...prev, currentIndex: newIndex };
        });
        return;
      }

      if (key.return) {
        // Save move
        try {
          const updated = moveShortcut(moveMode.shortcutId, moveMode.currentIndex);
          onUpdate(updated);
          setSelectedIndex(moveMode.currentIndex);
        } catch (err) {
          console.error("Failed to move shortcut:", err);
        }
        setMoveMode(null);
        return;
      }

      if (key.escape) {
        // Cancel move - revert selection
        setSelectedIndex(moveMode.originalIndex);
        setMoveMode(null);
        return;
      }

      return; // Block all other input in move mode
    }

    // Handle clear all confirmation
    if (confirmClearAll) {
      if (input === "y" || input === "Y") {
        clearShortcuts();
        onUpdate([]);
        setConfirmClearAll(false);
        setSelectedIndex(0);
      } else {
        // Any other key cancels
        setConfirmClearAll(false);
      }
      return;
    }

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
      } else {
        // Any other key cancels
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

    // Enter - edit, add, or clear all
    if (key.return) {
      if (isOnClearAll) {
        setConfirmClearAll(true);
      } else if (isOnAddNew) {
        onAddShortcut();
      } else {
        onEditShortcut(shortcuts[selectedIndex].id);
      }
      return;
    }

    // Ctrl+O - enter move mode (only on shortcut items)
    if (key.ctrl && input === settings.moveKey) {
      if (!isOnAddNew && !isOnClearAll && shortcuts.length > 0) {
        setMoveMode({
          shortcutId: shortcuts[selectedIndex].id,
          originalIndex: selectedIndex,
          currentIndex: selectedIndex,
        });
      }
      return;
    }

    // Ctrl+D - delete shortcut
    if (key.ctrl && input === "d") {
      if (!isOnAddNew && !isOnClearAll && shortcuts.length > 0) {
        setConfirmDelete(shortcuts[selectedIndex].id);
      }
      return;
    }

    // Tab - cycle tabs (Shift+Tab for reverse)
    if (key.tab) {
      onTab(key.shift);
      return;
    }

    // Escape - go back to Projects
    if (key.escape) {
      onClose();
      return;
    }
  });

  return (
    <Box flexDirection="column">
      {/* Tab bar at top */}
      {tabBar}

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

      {(() => {
        // Compute display order (reorder if in move mode)
        let displayList = shortcuts;
        if (moveMode) {
          const reordered = [...shortcuts];
          const movedIdx = reordered.findIndex((s) => s.id === moveMode.shortcutId);
          if (movedIdx !== -1) {
            const [moved] = reordered.splice(movedIdx, 1);
            reordered.splice(moveMode.currentIndex, 0, moved);
          }
          displayList = reordered;
        }

        return displayList.map((sc, idx) => {
          const isSelected = idx === selectedIndex;
          const isDeleting = confirmDelete === sc.id;
          const isMoving = moveMode?.shortcutId === sc.id;

          return (
            <Box key={sc.id}>
              <Text color={isSelected ? selectedColor : undefined} bold={isSelected}>
                {isSelected ? "> " : "  "}
                {isMoving ? "↕ " : ""}
                {sc.name}
              </Text>
              <Text dimColor> [{sc.trigger}]</Text>
              {isDeleting && (
                <Text color="red"> Delete? (y/n)</Text>
              )}
              {isMoving && (
                <Text color="yellow"> [MOVING]</Text>
              )}
            </Box>
          );
        });
      })()}

      <Box>
        <Text
          color={isOnAddNew ? selectedColor : "cyan"}
          bold={isOnAddNew}
        >
          {isOnAddNew ? "> " : "  "}[Add new shortcut]
        </Text>
      </Box>

      {hasClearAll && (
        <Box>
          <Text
            color={isOnClearAll ? selectedColor : "red"}
            bold={isOnClearAll}
          >
            {isOnClearAll ? "> " : "  "}[Clear all]
          </Text>
          {confirmClearAll && (
            <Text color="red"> Clear all shortcuts? (y/n)</Text>
          )}
        </Box>
      )}

      <Box>
        <Text color="gray" dimColor>
          ────────────────────────────────
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          {"  "}{moveMode
            ? "↑↓ move • enter save • esc cancel"
            : `tab/shift+tab • ↑↓ navigate • enter edit${shortcuts.length > 0 ? ` • ^${settings.moveKey.toUpperCase()} move • ^D delete` : ""} • esc close`
          }
        </Text>
      </Box>
    </Box>
  );
}
