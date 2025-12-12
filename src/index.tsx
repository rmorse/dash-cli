import React from "react";
import { render } from "ink";
import { App } from "./components/App.js";
import { scanProjects } from "./scanner.js";
import { getRecent, addRecent, writeLastSelection, getConfigDir } from "./history.js";
import { runSetup } from "./setup.js";

async function main() {
  const args = process.argv.slice(2);

  // Handle --setup command
  if (args[0] === "--setup") {
    await runSetup(args[1]);
    return;
  }

  const projects = scanProjects();
  const recentEntries = getRecent(5);

  let selectedPath: string | null = null;

  const { waitUntilExit, unmount } = render(
    <App
      projects={projects}
      recentEntries={recentEntries}
      onSelect={(path) => {
        selectedPath = path;
        unmount();
      }}
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
