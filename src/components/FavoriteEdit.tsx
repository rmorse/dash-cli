import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import type { Favorite } from "../types.js";
import { updateFavorite, validateShortcut } from "../favorites.js";
import { Breadcrumb } from "./Breadcrumb.js";

interface FavoriteEditProps {
  favorite: Favorite;
  allFavorites: Favorite[];
  onSave: (updated: Favorite) => void;
  onBack: () => void;
  breadcrumbs: string[];
}

type FieldKey = "name" | "shortcut" | "caseSensitive" | `cmd-${number}` | "add-line";

interface Field {
  key: FieldKey;
  label: string;
  type: "text" | "toggle" | "action";
}

export function FavoriteEdit({
  favorite,
  allFavorites,
  onSave,
  onBack,
  breadcrumbs,
}: FavoriteEditProps) {
  // Local state for editing
  const [name, setName] = useState(favorite.name);
  const [shortcut, setShortcut] = useState(favorite.shortcut);
  const [caseSensitive, setCaseSensitive] = useState(favorite.caseSensitive);
  const [commands, setCommands] = useState([...favorite.command]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editingField, setEditingField] = useState<FieldKey | null>(null);
  const [editValue, setEditValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Build dynamic field list
  const fields: Field[] = [
    { key: "name", label: "Name", type: "text" },
    { key: "shortcut", label: "Shortcut", type: "text" },
    { key: "caseSensitive", label: "Case Sensitive", type: "toggle" },
    ...commands.map((_, i) => ({
      key: `cmd-${i}` as FieldKey,
      label: `Command ${i + 1}`,
      type: "text" as const,
    })),
    { key: "add-line", label: "[Add line]", type: "action" },
  ];

  const totalItems = fields.length;
  const currentField = fields[selectedIndex];

  // Clear error after a delay
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const getValue = (key: FieldKey): string => {
    if (key === "name") return name;
    if (key === "shortcut") return shortcut;
    if (key === "caseSensitive") return caseSensitive ? "Yes" : "No";
    if (key.startsWith("cmd-")) {
      const idx = parseInt(key.split("-")[1], 10);
      return commands[idx] ?? "";
    }
    return "";
  };

  const setValue = (key: FieldKey, value: string) => {
    if (key === "name") setName(value);
    if (key === "shortcut") setShortcut(value);
    if (key.startsWith("cmd-")) {
      const idx = parseInt(key.split("-")[1], 10);
      setCommands((prev) => {
        const updated = [...prev];
        updated[idx] = value;
        return updated;
      });
    }
  };

  const startEditing = (field: Field) => {
    if (field.type === "toggle") {
      // Toggle immediately
      setCaseSensitive((prev) => !prev);
      return;
    }
    if (field.type === "action") {
      // Add line action
      setCommands((prev) => [...prev, ""]);
      // Move selection to the new command line
      setSelectedIndex(fields.length - 1); // This will be the new cmd line after re-render
      return;
    }
    // Start text editing
    setEditingField(field.key);
    setEditValue(getValue(field.key));
  };

  const commitEdit = () => {
    if (editingField) {
      setValue(editingField, editValue);
      setEditingField(null);
      setEditValue("");
    }
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  const deleteCommandLine = () => {
    if (!currentField.key.startsWith("cmd-")) return;
    if (commands.length <= 1) {
      setError("Cannot delete - at least one command required");
      return;
    }
    const idx = parseInt(currentField.key.split("-")[1], 10);
    setCommands((prev) => prev.filter((_, i) => i !== idx));
    // Adjust selection if needed
    if (selectedIndex >= 3 + commands.length - 1) {
      setSelectedIndex((prev) => prev - 1);
    }
  };

  const saveAndExit = () => {
    // Validate shortcut
    const validation = validateShortcut(shortcut, caseSensitive, favorite.id);
    if (!validation.valid) {
      setError(validation.error || "Invalid shortcut");
      return;
    }

    // Validate name
    if (!name.trim()) {
      setError("Name cannot be empty");
      return;
    }

    // Validate commands
    const nonEmptyCommands = commands.filter((c) => c.trim() !== "");
    if (nonEmptyCommands.length === 0) {
      setError("At least one command is required");
      return;
    }

    try {
      const updated = updateFavorite(favorite.id, {
        name: name.trim(),
        shortcut,
        caseSensitive,
        command: nonEmptyCommands,
      });
      onSave(updated);
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  };

  useInput((input, key) => {
    // Handle editing mode
    if (editingField) {
      if (key.escape) {
        cancelEdit();
        return;
      }
      if (key.return) {
        commitEdit();
        return;
      }
      if (key.backspace || key.delete) {
        setEditValue((prev) => prev.slice(0, -1));
        return;
      }
      // Regular character input
      if (input && input.length === 1 && !key.ctrl && !key.meta) {
        setEditValue((prev) => prev + input);
      }
      return;
    }

    // Navigation mode
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
      return;
    }

    // Enter - edit current field
    if (key.return) {
      startEditing(currentField);
      return;
    }

    // Ctrl+D - delete command line
    if (key.ctrl && input === "d") {
      deleteCommandLine();
      return;
    }

    // Escape or Tab - save and go back
    if (key.escape || key.tab) {
      saveAndExit();
      return;
    }
  });

  return (
    <Box flexDirection="column">
      <Breadcrumb items={breadcrumbs} />

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ── Edit Favorite ───────────────
        </Text>
      </Box>

      {/* Name field */}
      <Box>
        <Text
          color={selectedIndex === 0 ? "#FFD700" : undefined}
          bold={selectedIndex === 0}
        >
          {selectedIndex === 0 ? "> " : "  "}
          Name:
        </Text>
        <Text> </Text>
        {editingField === "name" ? (
          <>
            <Text color="cyan">{editValue}</Text>
            <Text color="cyan">▌</Text>
          </>
        ) : (
          <Text color={selectedIndex === 0 ? "#FFD700" : "white"}>{name}</Text>
        )}
      </Box>

      {/* Shortcut field */}
      <Box>
        <Text
          color={selectedIndex === 1 ? "#FFD700" : undefined}
          bold={selectedIndex === 1}
        >
          {selectedIndex === 1 ? "> " : "  "}
          Shortcut:
        </Text>
        <Text> </Text>
        {editingField === "shortcut" ? (
          <>
            <Text color="cyan">{editValue}</Text>
            <Text color="cyan">▌</Text>
          </>
        ) : (
          <Text color={selectedIndex === 1 ? "#FFD700" : "white"}>
            {shortcut}
          </Text>
        )}
      </Box>

      {/* Case Sensitive toggle */}
      <Box>
        <Text
          color={selectedIndex === 2 ? "#FFD700" : undefined}
          bold={selectedIndex === 2}
        >
          {selectedIndex === 2 ? "> " : "  "}
          Case Sensitive:
        </Text>
        <Text> </Text>
        <Text color={selectedIndex === 2 ? "#FFD700" : "white"}>
          {caseSensitive ? "Yes" : "No"}
        </Text>
      </Box>

      {/* Commands section */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ── Commands ────────────────────
        </Text>
      </Box>

      {commands.map((cmd, idx) => {
        const fieldIdx = 3 + idx;
        const isSelected = selectedIndex === fieldIdx;
        const isEditing = editingField === `cmd-${idx}`;

        return (
          <Box key={`cmd-${idx}`}>
            <Text
              color={isSelected ? "#FFD700" : undefined}
              bold={isSelected}
            >
              {isSelected ? "> " : "  "}
            </Text>
            {isEditing ? (
              <>
                <Text color="cyan">{editValue}</Text>
                <Text color="cyan">▌</Text>
              </>
            ) : (
              <Text color={isSelected ? "#FFD700" : cmd ? "white" : "gray"}>
                {cmd || "(empty)"}
              </Text>
            )}
          </Box>
        );
      })}

      {/* Add line action */}
      <Box marginTop={1}>
        <Text
          color={selectedIndex === fields.length - 1 ? "#FFD700" : "cyan"}
          bold={selectedIndex === fields.length - 1}
        >
          {selectedIndex === fields.length - 1 ? "> " : "  "}[Add line]
        </Text>
      </Box>

      {/* Error message */}
      {error && (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ────────────────────────────────
        </Text>
      </Box>

      <Box>
        <Text dimColor>
          enter edit • ^D delete line • esc/tab save & back
        </Text>
      </Box>
    </Box>
  );
}
