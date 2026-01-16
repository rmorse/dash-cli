import type { ParsedArgs } from "./types.js";

/**
 * Parse argv array into command, positional args, and flags.
 * Example: "add proj Name cmd --json" -> {command:"add", positional:["proj","Name","cmd"], flags:{json:true}}
 */
export function parseArgv(argv: string[]): ParsedArgs {
  if (argv.length === 0) {
    return { command: null, positional: [], flags: {} };
  }

  const command = argv[0];
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  let i = 1;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg.startsWith("--")) {
      const flagName = arg.slice(2);

      // Check if next arg is a value (not another flag)
      const nextArg = argv[i + 1];
      if (nextArg && !nextArg.startsWith("--")) {
        flags[flagName] = nextArg;
        i += 2;
      } else {
        flags[flagName] = true;
        i += 1;
      }
    } else {
      positional.push(arg);
      i += 1;
    }
  }

  return { command, positional, flags };
}
