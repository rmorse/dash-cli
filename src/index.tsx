import React from "react";
import { render } from "ink";
import { App } from "./components/App.js";
import { getRecentAsync, addRecent, writeLastCommand } from "./history.js";
import { getFavoritesAsync, getFavoriteByShortcutAsync, generateCommand } from "./favorites.js";
import { loadSettingsAsync, saveSettings } from "./settings.js";
import { runSetup } from "./setup.js";
import { initLog, log } from "./logger.js";

async function main() {
  const args = process.argv.slice(2);

  // Check for --debug flag
  const debugMode = args.includes("--debug");
  const filteredArgs = args.filter(arg => arg !== "--debug");

  initLog(debugMode);
  log("main() started");
  log(`args: ${JSON.stringify(filteredArgs)}`);

  // Handle --setup command
  if (filteredArgs[0] === "--setup") {
    log("running setup");
    await runSetup(filteredArgs[1], filteredArgs[2]);
    return;
  }

  // Handle shortcut arguments for quick favorite access (supports chaining)
  const shortcutArgs = filteredArgs.filter(arg => !arg.startsWith("--"));
  if (shortcutArgs.length > 0) {
    log(`quick favorite access: ${shortcutArgs.join(" ")}`);
    const allCommands: string[] = [];

    for (const shortcut of shortcutArgs) {
      const favorite = await getFavoriteByShortcutAsync(shortcut);
      if (!favorite) {
        console.error(`Shortcut not found: ${shortcut}`);
        process.exit(1);
      }
      log(`found favorite: ${favorite.name}`);
      allCommands.push(...favorite.command);
    }

    writeLastCommand(allCommands);
    return;
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
    writeLastCommand(generateCommand(selectedPath));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
