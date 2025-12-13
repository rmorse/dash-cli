import React from "react";
import { render } from "ink";
import { App } from "./components/App.js";
import { getRecentAsync, addRecent, writeLastSelection, getFavoritesAsync } from "./history.js";
import { loadSettingsAsync, saveSettings } from "./settings.js";
import { runSetup } from "./setup.js";
import { initLog, log } from "./logger.js";

// This runs after all imports are loaded
console.error(`[${new Date().toISOString()}] All modules loaded, starting main...`);

async function main() {
  initLog();
  log("main() started");

  const args = process.argv.slice(2);
  log(`args: ${JSON.stringify(args)}`);

  // Handle --setup command
  if (args[0] === "--setup") {
    log("running setup");
    await runSetup(args[1], args[2]);
    return;
  }

  // Handle numeric argument for quick favorite access
  const favoriteIndex = parseInt(args[0], 10);
  if (!isNaN(favoriteIndex) && favoriteIndex > 0) {
    log(`quick favorite access: ${favoriteIndex}`);
    const favorites = await getFavoritesAsync();
    log(`loaded ${favorites.length} favorites`);
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

  // Load config files asynchronously
  log("loading settings...");
  const settings = await loadSettingsAsync();
  log(`settings loaded, projectsDir: ${settings.projectsDir}`);

  log("loading recent and favorites...");
  const [recentEntries, favoriteEntries] = await Promise.all([
    getRecentAsync(settings.recentCount),
    getFavoritesAsync(),
  ]);
  log(`loaded ${recentEntries.length} recent, ${favoriteEntries.length} favorites`);

  let selectedPath: string | null = null;
  let selectedDisplayName: string | null = null;

  log("about to render App...");
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
  log("render() returned, waiting for exit...");

  await waitUntilExit();
  log("app exited");

  if (selectedPath && selectedDisplayName) {
    addRecent(selectedPath, selectedDisplayName);
    writeLastSelection(selectedPath);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
