import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import open from "open";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Settings } from "../types.js";
import { SETTING_FIELDS } from "../settings.js";
import { clearHistory } from "../history.js";
import { clearFavorites } from "../favorites.js";
import { Breadcrumb } from "./Breadcrumb.js";

const CONFIG_FILE = join(homedir(), ".dash-cli", "settings.json");

interface SettingsProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
  onCancel: () => void;
  onClearFavorites: () => void;
  onClearHistory: () => void;
  onEditFavorites: () => void;
  breadcrumbs: string[];
}

// Total items: settings fields + 4 action items (Edit favorites, Clear favorites, Clear history, Edit config)
const TOTAL_ITEMS = SETTING_FIELDS.length + 4;
const EDIT_FAVORITES_INDEX = SETTING_FIELDS.length;
const CLEAR_FAVORITES_INDEX = SETTING_FIELDS.length + 1;
const CLEAR_HISTORY_INDEX = SETTING_FIELDS.length + 2;
const EDIT_CONFIG_INDEX = SETTING_FIELDS.length + 3;

export function SettingsScreen({ settings, onSave, onCancel, onClearFavorites, onClearHistory, onEditFavorites, breadcrumbs }: SettingsProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editingKey, setEditingKey] = useState<keyof Settings | null>(null);
  const [editValue, setEditValue] = useState("");
  const [localSettings, setLocalSettings] = useState<Settings>({ ...settings });

  const isOnEditFavorites = selectedIndex === EDIT_FAVORITES_INDEX;
  const isOnClearFavorites = selectedIndex === CLEAR_FAVORITES_INDEX;
  const isOnClearHistory = selectedIndex === CLEAR_HISTORY_INDEX;
  const isOnEditConfig = selectedIndex === EDIT_CONFIG_INDEX;
  const isOnActionItem = isOnEditFavorites || isOnClearFavorites || isOnClearHistory || isOnEditConfig;
  const currentField = isOnActionItem ? null : SETTING_FIELDS[selectedIndex];
  const isEditing = editingKey !== null;

  const [favoritesCleared, setFavoritesCleared] = useState(false);
  const [historyCleared, setHistoryCleared] = useState(false);

  const openConfigFile = async () => {
    await open(CONFIG_FILE);
  };

  const handleClearFavorites = () => {
    clearFavorites();
    onClearFavorites();
    setFavoritesCleared(true);
  };

  const handleClearHistory = () => {
    clearHistory();
    onClearHistory();
    setHistoryCleared(true);
  };

  const startEditing = () => {
    if (isOnEditFavorites) {
      onEditFavorites();
      return;
    }
    if (isOnClearFavorites) {
      handleClearFavorites();
      return;
    }
    if (isOnClearHistory) {
      handleClearHistory();
      return;
    }
    if (isOnEditConfig) {
      openConfigFile();
      return;
    }
    const field = SETTING_FIELDS[selectedIndex];
    const value = localSettings[field.key];
    setEditingKey(field.key);
    setEditValue(String(value));
  };

  const isValidShortcutKey = (key: string): boolean => {
    return /^[a-zA-Z0-9]$/.test(key);
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
    } else if (field.type === "key") {
      // Validate key input - must be single letter or number
      const key = editValue.toLowerCase();
      if (isValidShortcutKey(key)) {
        newValue = key;
      } else {
        // Keep existing value if invalid
        newValue = localSettings[editingKey] as string;
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

  // Check if current editing field uses TextInput (not number or key types)
  const usesTextInput = currentField && !["number", "key"].includes(currentField.type);

  useInput((input, key) => {
    if (isEditing) {
      // For TextInput fields, only handle Escape
      if (usesTextInput) {
        if (key.escape) {
          cancelEdit();
        }
        // Let TextInput handle everything else
        return;
      }

      // For number/key fields, use manual handling
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
          // For key type, only accept single letter/number and auto-commit
          if (currentField?.type === "key") {
            if (isValidShortcutKey(input)) {
              setEditValue(input.toLowerCase());
              // Auto-commit after valid key input
              setTimeout(() => {
                setLocalSettings((prev) => ({
                  ...prev,
                  [editingKey!]: input.toLowerCase(),
                }));
                setEditingKey(null);
                setEditValue("");
              }, 0);
            }
            return;
          }
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
    if (field.type === "key") {
      return `Ctrl+${str.toUpperCase()}`;
    }
    return str;
  };

  return (
    <Box flexDirection="column">
      <Breadcrumb items={breadcrumbs} />

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
        const displayValue = formatValue(field, value);
        const useTextInputForField = !["number", "key"].includes(field.type);

        return (
          <Box key={field.key} flexDirection="row">
            <Text color={isSelected ? "#FFD700" : undefined} bold={isSelected}>
              {isSelected ? "> " : "  "}
              {field.label.padEnd(20)}
            </Text>
            {isFieldEditing && useTextInputForField ? (
              <TextInput
                value={editValue}
                onChange={setEditValue}
                onSubmit={commitEdit}
                focus={true}
              />
            ) : (
              <>
                <Text
                  color={isFieldEditing ? "#FFD700" : isSelected ? "#FFD700" : "gray"}
                >
                  {isFieldEditing ? editValue : displayValue}
                </Text>
                {isFieldEditing && <Text color="#FFD700">|</Text>}
              </>
            )}
            {field.type === "color" && !isFieldEditing && (
              <>
                <Text>{"  "}</Text>
                <Text backgroundColor={String(value)}>{"    "}</Text>
              </>
            )}
          </Box>
        );
      })}

      {/* Edit favorites option */}
      <Box>
        <Text color={isOnEditFavorites ? "#FFD700" : "gray"} bold={isOnEditFavorites}>
          {isOnEditFavorites ? "> " : "  "}
          {"Edit favorites..."}
        </Text>
      </Box>

      {/* Clear favorites option */}
      <Box>
        <Text color={isOnClearFavorites ? "#FFD700" : "gray"} bold={isOnClearFavorites}>
          {isOnClearFavorites ? "> " : "  "}
          {"Clear favorites..."}
        </Text>
        {favoritesCleared && <Text color="green">{" "}✓</Text>}
      </Box>

      {/* Clear history option */}
      <Box>
        <Text color={isOnClearHistory ? "#FFD700" : "gray"} bold={isOnClearHistory}>
          {isOnClearHistory ? "> " : "  "}
          {"Clear history..."}
        </Text>
        {historyCleared && <Text color="green">{" "}✓</Text>}
      </Box>

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
        <Text dimColor>
          {"  "}
          {isOnEditFavorites
            ? "Manage favorites: edit names, shortcuts, and commands"
            : isOnClearFavorites
              ? "Remove all favorite projects"
              : isOnClearHistory
                ? "Remove all recent projects from history"
                : isOnEditConfig
                  ? "Open settings.json in default editor"
                  : currentField?.description}
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          {isEditing
            ? currentField?.type === "number"
              ? "  type or ↑↓ adjust • enter save • esc cancel"
              : "  ←→ cursor • enter save • esc cancel"
            : "  ↑↓ navigate • enter edit • esc save & exit"}
        </Text>
      </Box>
    </Box>
  );
}
