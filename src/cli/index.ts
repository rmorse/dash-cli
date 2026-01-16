import { parseArgv } from "./parser.js";
import { createFormatter } from "./formatters.js";
import { commands, showHelp } from "./commands.js";

/**
 * Main CLI dispatcher. Called from src/index.tsx when -- separator detected.
 */
export async function dispatch(argv: string[]): Promise<void> {
  const { command, positional, flags } = parseArgv(argv);
  const useJson = flags.json === true;
  const fmt = createFormatter(useJson);

  // No command or help flag
  if (!command || command === "help" || flags.help) {
    showHelp(fmt);
    return;
  }

  // Find handler
  const handler = commands[command];
  if (!handler) {
    fmt.error(`Unknown command: ${command}. Run "dash -- help" for usage.`);
  }

  await handler(positional, flags, fmt);
}
