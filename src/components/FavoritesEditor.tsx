import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { Favorite } from "../types.js";
import { removeFavorite } from "../favorites.js";
import { Breadcrumb } from "./Breadcrumb.js";

interface FavoritesEditorProps {
  favorites: Favorite[];
  onUpdate: (favorites: Favorite[]) => void;
  onEditFavorite: (id: string) => void;
  onAddFavorite: () => void;
  onBack: () => void;
  breadcrumbs: string[];
}

export function FavoritesEditor({
  favorites,
  onUpdate,
  onEditFavorite,
  onAddFavorite,
  onBack,
  breadcrumbs,
}: FavoritesEditorProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Items: favorites + "Add new favorite" action
  const totalItems = favorites.length + 1;
  const isOnAddNew = selectedIndex === favorites.length;

  useInput((input, key) => {
    // Handle delete confirmation
    if (confirmDelete) {
      if (input === "y" || input === "Y") {
        removeFavorite(confirmDelete);
        onUpdate(favorites.filter((f) => f.id !== confirmDelete));
        setConfirmDelete(null);
        // Adjust selection if needed
        if (selectedIndex >= favorites.length - 1) {
          setSelectedIndex(Math.max(0, favorites.length - 2));
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
        onAddFavorite();
      } else {
        onEditFavorite(favorites[selectedIndex].id);
      }
      return;
    }

    // Ctrl+D - delete favorite
    if (key.ctrl && input === "d") {
      if (!isOnAddNew && favorites.length > 0) {
        setConfirmDelete(favorites[selectedIndex].id);
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
          ── Favorites ──────────────────
        </Text>
      </Box>

      {favorites.length === 0 && (
        <Box>
          <Text color="gray" dimColor>
            {"  "}No favorites yet
          </Text>
        </Box>
      )}

      {favorites.map((fav, idx) => {
        const isSelected = idx === selectedIndex;
        const isDeleting = confirmDelete === fav.id;

        return (
          <Box key={fav.id}>
            <Text color={isSelected ? "#FFD700" : undefined} bold={isSelected}>
              {isSelected ? "> " : "  "}
              {fav.name}
            </Text>
            <Text dimColor> [{fav.shortcut}]</Text>
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
          {isOnAddNew ? "> " : "  "}[Add new favorite]
        </Text>
      </Box>

      <Box>
        <Text color="gray" dimColor>
          ────────────────────────────────
        </Text>
      </Box>
      <Box>
        <Text dimColor>
          enter edit {favorites.length > 0 ? "• ^D delete " : ""}• esc/tab back
        </Text>
      </Box>
    </Box>
  );
}
