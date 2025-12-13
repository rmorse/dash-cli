import React from "react";
import { render } from "ink";
import { App } from "./components/App.js";
import { scanProjects } from "./scanner.js";
import { getRecent, addRecent, writeLastSelection, getConfigDir } from "./history.js";
import { loadSettings, saveSettings } from "./settings.js";
import { runSetup } from "./setup.js";

async function main() {
  const args = process.argv.slice(2);

  // Handle --setup command
  if (args[0] === "--setup") {
    await runSetup(args[1]);
    return;
  }

  const settings = loadSettings();
  const projects = scanProjects(settings);
  const recentEntries = getRecent(settings.recentCount);

  let selectedPath: string | null = null;

  const { waitUntilExit, unmount } = render(
    <App
      initialProjects={projects}
      initialSettings={settings}
      recentEntries={recentEntries}
      onSelect={(path) => {
        selectedPath = path;
        unmount();
      }}
      onSettingsSave={saveSettings}
    />,
    {
      exitOnCtrlC: true,
    }
  );

  await waitUntilExit();

  if (selectedPath) {
    addRecent(selectedPath);
    writeLastSelection(selectedPath);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
