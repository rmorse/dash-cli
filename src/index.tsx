import React from "react";
import { render } from "ink";
import { App } from "./components/App.js";
import { getRecentAsync, addRecent, writeLastCommand } from "./history.js";
import { getShortcutsAsync, getShortcutByTriggerAsync, generateCommand } from "./shortcuts.js";
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

  // Handle trigger arguments for quick shortcut access (supports chaining)
  const triggerArgs = filteredArgs.filter(arg => !arg.startsWith("--"));
  if (triggerArgs.length > 0) {
    log(`quick shortcut access: ${triggerArgs.join(" ")}`);
    const allCommands: string[] = [];

    for (const trigger of triggerArgs) {
      const shortcut = await getShortcutByTriggerAsync(trigger);
      if (!shortcut) {
        console.error(`Shortcut not found: ${trigger}`);
        process.exit(1);
      }
      log(`found shortcut: ${shortcut.name}`);
      allCommands.push(...shortcut.command);
    }

    writeLastCommand(allCommands);
    return;
  }

  // Load config files asynchronously
  log("loading settings...");
  const settings = await loadSettingsAsync();
  log(`settings loaded, projectsDir: ${settings.projectsDir}`);

  log("loading recent and shortcuts...");
  const [recentEntries, shortcutEntries] = await Promise.all([
    getRecentAsync(settings.recentCount),
    getShortcutsAsync(),
  ]);
  log(`loaded ${recentEntries.length} recent, ${shortcutEntries.length} shortcuts`);

  let selectedPath: string | null = null;
  let selectedDisplayName: string | null = null;

  log("about to render App...");
  const { waitUntilExit, unmount } = render(
    <App
      initialSettings={settings}
      recentEntries={recentEntries}
      shortcutEntries={shortcutEntries}
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
