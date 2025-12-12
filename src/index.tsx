import React from "react";
import { render } from "ink";
import { App } from "./components/App.js";
import { scanProjects } from "./scanner.js";
import { getRecent, addRecent } from "./history.js";

async function main() {
  const projects = scanProjects();
  const recentEntries = getRecent(5);

  let selectedPath: string | null = null;

  const { waitUntilExit } = render(
    <App
      projects={projects}
      recentEntries={recentEntries}
      onSelect={(path) => {
        selectedPath = path;
        process.exit(0);
      }}
    />
  );

  await waitUntilExit();

  if (selectedPath) {
    addRecent(selectedPath);
    console.log(selectedPath);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
