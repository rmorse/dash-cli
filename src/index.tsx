import React from "react";
import { render } from "ink";
import { App } from "./components/App.js";
import { getRecent, addRecent, writeLastSelection, getFavorites } from "./history.js";
import { loadSettings, saveSettings } from "./settings.js";
import { runSetup } from "./setup.js";

async function main() {
  const args = process.argv.slice(2);

  // Handle --setup command
  if (args[0] === "--setup") {
    await runSetup(args[1], args[2]);
    return;
  }

  // Handle numeric argument for quick favorite access
  const favoriteIndex = parseInt(args[0], 10);
  if (!isNaN(favoriteIndex) && favoriteIndex > 0) {
    const favorites = getFavorites();
    if (favoriteIndex <= favorites.length) {
      const favorite = favorites[favoriteIndex - 1];
      writeLastSelection(favorite.path);
      return;
    } else {
      console.error(
        `Favorite #${favoriteIndex} does not exist. You have ${favorites.length} favorite(s).`
      );
      process.exit(1);
    }
  }

  const settings = loadSettings();
  const recentEntries = getRecent(settings.recentCount);
  const favoriteEntries = getFavorites();

  let selectedPath: string | null = null;
  let selectedDisplayName: string | null = null;

  const { waitUntilExit, unmount } = render(
    <App
      initialSettings={settings}
      recentEntries={recentEntries}
      favoriteEntries={favoriteEntries}
      onSelect={(path, displayName) => {
        selectedPath = path;
        selectedDisplayName = displayName;
        unmount();
      }}
      onSettingsSave={saveSettings}
    />,
    {
      exitOnCtrlC: true,
    }
  );

  await waitUntilExit();

  if (selectedPath && selectedDisplayName) {
    addRecent(selectedPath, selectedDisplayName);
    writeLastSelection(selectedPath);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
