import React from "react";
import { render } from "ink";
import { App } from "./components/App.js";
import { scanProjects } from "./scanner.js";
import { getRecent, addRecent } from "./history.js";

async function main() {
  console.error("[debug] Starting...");

  const projects = scanProjects();
  console.error(`[debug] Found ${projects.length} projects`);

  const recentEntries = getRecent(5);
  console.error(`[debug] Found ${recentEntries.length} recent entries`);

  let selectedPath: string | null = null;

  console.error("[debug] Rendering...");
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
      stdout: process.stderr,
    }
  );

  console.error("[debug] Waiting for exit...");

  await waitUntilExit();

  console.error("[debug] Exited");

  if (selectedPath) {
    addRecent(selectedPath);
    console.log(selectedPath);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
