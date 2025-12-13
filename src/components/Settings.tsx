import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import open from "open";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Settings } from "../types.js";
import { SETTING_FIELDS } from "../settings.js";

const CONFIG_FILE = join(homedir(), ".projects-cli", "settings.json");

interface SettingsProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
  onCancel: () => void;
}

// Total items: settings fields + "Edit config file" action
const TOTAL_ITEMS = SETTING_FIELDS.length + 1;
const EDIT_CONFIG_INDEX = SETTING_FIELDS.length;

export function SettingsScreen({ settings, onSave, onCancel }: SettingsProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editingKey, setEditingKey] = useState<keyof Settings | null>(null);
  const [editValue, setEditValue] = useState("");
  const [localSettings, setLocalSettings] = useState<Settings>({ ...settings });

  const isOnEditConfig = selectedIndex === EDIT_CONFIG_INDEX;
  const currentField = isOnEditConfig ? null : SETTING_FIELDS[selectedIndex];
  const isEditing = editingKey !== null;

  const openConfigFile = async () => {
    await open(CONFIG_FILE);
  };

  const startEditing = () => {
    if (isOnEditConfig) {
      openConfigFile();
      return;
    }
    const field = SETTING_FIELDS[selectedIndex];
    const value = localSettings[field.key];
    setEditingKey(field.key);
    setEditValue(String(value));
  };

  const commitEdit = () => {
    if (!editingKey) return;

    const field = SETTING_FIELDS.find((f) => f.key === editingKey);
    if (!field) return;

    let newValue: string | number = editValue;

    if (field.type === "number") {
      const num = parseInt(editValue, 10);
      if (!isNaN(num)) {
        const min = field.min ?? 1;
        const max = field.max ?? 100;
        newValue = Math.max(min, Math.min(max, num));
      } else {
        newValue = localSettings[editingKey] as number;
      }
    }

    setLocalSettings((prev) => ({
      ...prev,
      [editingKey]: newValue,
    }));
    setEditingKey(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue("");
  };

  const adjustNumber = (delta: number) => {
    if (!editingKey) return;
    const field = SETTING_FIELDS.find((f) => f.key === editingKey);
    if (field?.type !== "number") return;

    const current = parseInt(editValue, 10) || 0;
    const min = field.min ?? 1;
    const max = field.max ?? 100;
    const newValue = Math.max(min, Math.min(max, current + delta));
    setEditValue(String(newValue));
  };

  useInput((input, key) => {
    if (isEditing) {
      // Edit mode input handling
      if (key.escape) {
        cancelEdit();
        return;
      }

      if (key.return) {
        commitEdit();
        return;
      }

      // Number adjustment with arrows
      if (currentField?.type === "number") {
        if (key.upArrow) {
          adjustNumber(1);
          return;
        }
        if (key.downArrow) {
          adjustNumber(-1);
          return;
        }
      }

      if (key.backspace || key.delete) {
        setEditValue((prev) => prev.slice(0, -1));
        return;
      }

      // Regular character input
      if (input && input.length === 1 && !key.ctrl && !key.meta) {
        if (input.charCodeAt(0) >= 32) {
          setEditValue((prev) => prev + input);
        }
      }
      return;
    }

    // Navigation mode input handling
    if (key.escape) {
      onSave(localSettings);
      return;
    }

    // Tab also exits
    if (key.tab) {
      onSave(localSettings);
      return;
    }

    if (key.return) {
      startEditing();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) =>
        prev <= 0 ? TOTAL_ITEMS - 1 : prev - 1
      );
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((prev) =>
        prev >= TOTAL_ITEMS - 1 ? 0 : prev + 1
      );
      return;
    }
  });

  const formatValue = (field: (typeof SETTING_FIELDS)[0], value: string | number): string => {
    const str = String(value);
    if (field.type === "text" && str.length > 35) {
      return str.slice(0, 32) + "...";
    }
    if (field.type === "path" && str.length > 35) {
      return str.slice(0, 32) + "...";
    }
    return str;
  };

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="gray">{"  "}Settings </Text>
        <Text dimColor>(Tab to close)</Text>
      </Box>

      <Box>
        <Text dimColor>{"  "}───────────────────────────────────────</Text>
      </Box>

      {SETTING_FIELDS.map((field, idx) => {
        const isSelected = idx === selectedIndex;
        const isFieldEditing = editingKey === field.key;
        const value = localSettings[field.key];
        const displayValue = isFieldEditing
          ? editValue
          : formatValue(field, value);

        return (
          <Box key={field.key} flexDirection="row">
            <Text color={isSelected ? "#FFD700" : undefined} bold={isSelected}>
              {isSelected ? "> " : "  "}
              {field.label.padEnd(20)}
            </Text>
            <Text
              color={isFieldEditing ? "#FFD700" : isSelected ? "#FFD700" : "gray"}
            >
              {displayValue}
            </Text>
            {isFieldEditing && <Text color="#FFD700">|</Text>}
            {field.type === "color" && !isFieldEditing && (
              <Text>{"  "}</Text>
            )}
            {field.type === "color" && !isFieldEditing && (
              <Text backgroundColor={String(value)}>{"    "}</Text>
            )}
          </Box>
        );
      })}

      {/* Edit config file option */}
      <Box>
        <Text color={isOnEditConfig ? "#FFD700" : "gray"} bold={isOnEditConfig}>
          {isOnEditConfig ? "> " : "  "}
          {"Edit config file..."}
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>{"  "}───────────────────────────────────────</Text>
      </Box>

      {/* Description of selected field */}
      <Box>
        <Text dimColor>{"  "}{isOnEditConfig ? "Open settings.json in default editor" : currentField?.description}</Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          {isEditing
            ? currentField?.type === "number"
              ? "  type or ↑↓ adjust • enter save • esc cancel"
              : "  type to edit • enter save • esc cancel"
            : "  ↑↓ navigate • enter edit • esc save & exit"}
        </Text>
      </Box>
    </Box>
  );
}
