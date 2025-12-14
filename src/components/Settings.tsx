import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import open from "open";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Settings } from "../types.js";
import { SETTING_FIELDS } from "../settings.js";
import { clearHistory } from "../history.js";
import { clearShortcuts } from "../shortcuts.js";

const CONFIG_FILE = join(homedir(), ".dash-cli", "settings.json");

interface SettingsProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
  onClearShortcuts: () => void;
  onClearHistory: () => void;
  onTab: (reverse?: boolean) => void;
  onClose: () => void;
  tabBar: React.ReactNode;
}


export function SettingsScreen({ settings, onSave, onClearShortcuts, onClearHistory, onTab, onClose, tabBar }: SettingsProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editingKey, setEditingKey] = useState<keyof Settings | null>(null);
  const [editValue, setEditValue] = useState("");
  const [localSettings, setLocalSettings] = useState<Settings>({ ...settings });

  // Filter fields based on showIf condition
  const visibleFields = SETTING_FIELDS.filter(
    (field) => !field.showIf || field.showIf(localSettings)
  );

  // Dynamic indices based on visible fields (3 action items: Clear shortcuts, Clear history, Edit config)
  const totalItems = visibleFields.length + 3;
  const clearShortcutsIndex = visibleFields.length;
  const clearHistoryIndex = visibleFields.length + 1;
  const editConfigIndex = visibleFields.length + 2;

  const isOnClearShortcuts = selectedIndex === clearShortcutsIndex;
  const isOnClearHistory = selectedIndex === clearHistoryIndex;
  const isOnEditConfig = selectedIndex === editConfigIndex;
  const isOnActionItem = isOnClearShortcuts || isOnClearHistory || isOnEditConfig;
  const currentField = isOnActionItem ? null : visibleFields[selectedIndex];
  const isEditing = editingKey !== null;

  const [shortcutsCleared, setShortcutsCleared] = useState(false);
  const [historyCleared, setHistoryCleared] = useState(false);

  const openConfigFile = async () => {
    await open(CONFIG_FILE);
  };

  const handleClearShortcuts = () => {
    clearShortcuts();
    onClearShortcuts();
    setShortcutsCleared(true);
  };

  const handleClearHistory = () => {
    clearHistory();
    onClearHistory();
    setHistoryCleared(true);
  };

  const startEditing = () => {
    if (isOnClearShortcuts) {
      handleClearShortcuts();
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
    const field = visibleFields[selectedIndex];
    const value = localSettings[field.key];

    // Toggle type: immediately flip the boolean value
    if (field.type === "toggle") {
      setLocalSettings((prev) => ({
        ...prev,
        [field.key]: !prev[field.key],
      }));
      return;
    }

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

      // Number adjustment with arrows (all four directions)
      if (currentField?.type === "number") {
        if (key.upArrow || key.rightArrow) {
          adjustNumber(1);
          return;
        }
        if (key.downArrow || key.leftArrow) {
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
    // Tab - save and cycle tabs (Shift+Tab for reverse)
    if (key.tab) {
      onSave(localSettings);
      onTab(key.shift);
      return;
    }

    // Escape - save and close (go to Projects)
    if (key.escape) {
      onSave(localSettings);
      onClose();
      return;
    }

    if (key.return) {
      startEditing();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) =>
        prev <= 0 ? totalItems - 1 : prev - 1
      );
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((prev) =>
        prev >= totalItems - 1 ? 0 : prev + 1
      );
      return;
    }
  });

  const formatValue = (field: (typeof SETTING_FIELDS)[0], value: string | number | boolean): string => {
    if (field.type === "toggle") {
      return value ? "Yes" : "No";
    }
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
      {/* Tab bar at top */}
      {tabBar}

      <Box>
        <Text dimColor>{"  "}───────────────────────────────────────</Text>
      </Box>

      {visibleFields.map((field, idx) => {
        const isSelected = idx === selectedIndex;
        const isFieldEditing = editingKey === field.key;
        const value = localSettings[field.key];
        const displayValue = formatValue(field, value);
        const useTextInputForField = !["number", "key", "toggle"].includes(field.type);

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

      {/* Clear shortcuts option */}
      <Box>
        <Text color={isOnClearShortcuts ? "#FFD700" : "gray"} bold={isOnClearShortcuts}>
          {isOnClearShortcuts ? "> " : "  "}
          {"Clear shortcuts..."}
        </Text>
        {shortcutsCleared && <Text color="green">{" "}✓</Text>}
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
          {isOnClearShortcuts
            ? "Remove all shortcuts"
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
              ? "  type or ←→↑↓ adjust • enter save • esc cancel"
              : "  ←→ cursor • enter save • esc cancel"
            : currentField?.type === "toggle"
              ? "  tab/shift+tab • ↑↓ navigate • enter toggle • esc close"
              : "  tab/shift+tab • ↑↓ navigate • enter edit • esc close"}
        </Text>
      </Box>
    </Box>
  );
}
