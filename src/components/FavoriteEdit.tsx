import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
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

  const handleChange = (key: FieldKey, value: string) => {
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
      setCaseSensitive((prev) => !prev);
      return;
    }
    if (field.type === "action") {
      setCommands((prev) => [...prev, ""]);
      setSelectedIndex(fields.length - 1);
      return;
    }
    setEditingField(field.key);
  };

  const commitEdit = () => {
    setEditingField(null);
  };

  const deleteCommandLine = () => {
    if (!currentField.key.startsWith("cmd-")) return;
    if (commands.length <= 1) {
      setError("Cannot delete - at least one command required");
      return;
    }
    const idx = parseInt(currentField.key.split("-")[1], 10);
    setCommands((prev) => prev.filter((_, i) => i !== idx));
    if (selectedIndex >= 3 + commands.length - 1) {
      setSelectedIndex((prev) => prev - 1);
    }
  };

  const saveAndExit = () => {
    const validation = validateShortcut(shortcut, caseSensitive, favorite.id);
    if (!validation.valid) {
      setError(validation.error || "Invalid shortcut");
      return;
    }

    if (!name.trim()) {
      setError("Name cannot be empty");
      return;
    }

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
    // When editing, only handle Escape to cancel
    if (editingField) {
      if (key.escape) {
        setEditingField(null);
        return;
      }
      // Let TextInput handle everything else
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

    if (key.return) {
      startEditing(currentField);
      return;
    }

    if (key.ctrl && input === "d") {
      deleteCommandLine();
      return;
    }

    if (key.escape || key.tab) {
      saveAndExit();
      return;
    }
  });

  const renderField = (field: Field, idx: number) => {
    const isSelected = idx === selectedIndex;
    const isEditing = editingField === field.key;
    const value = getValue(field.key);

    return (
      <Box key={field.key}>
        <Text
          color={isSelected ? "#FFD700" : undefined}
          bold={isSelected}
        >
          {isSelected ? "> " : "  "}
          {field.label}:
        </Text>
        <Text> </Text>
        {isEditing ? (
          <TextInput
            value={value}
            onChange={(newValue) => handleChange(field.key, newValue)}
            onSubmit={commitEdit}
            focus={true}
          />
        ) : (
          <Text color={isSelected ? "#FFD700" : value ? "white" : "gray"}>
            {value || "(empty)"}
          </Text>
        )}
      </Box>
    );
  };

  return (
    <Box flexDirection="column">
      <Breadcrumb items={breadcrumbs} />

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ── Edit Favorite ───────────────
        </Text>
      </Box>

      {/* Name field */}
      {renderField(fields[0], 0)}

      {/* Shortcut field */}
      {renderField(fields[1], 1)}

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
        const field = fields[fieldIdx];
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
              <TextInput
                value={cmd}
                onChange={(newValue) => handleChange(`cmd-${idx}`, newValue)}
                onSubmit={commitEdit}
                focus={true}
              />
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
          enter edit • ^D delete line • esc save & back
        </Text>
      </Box>
    </Box>
  );
}
