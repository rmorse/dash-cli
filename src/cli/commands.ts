import type { CommandHandler, OutputFormatter, ShortcutRow } from "./types.js";
import type { Shortcut } from "../types.js";
import {
  getShortcuts,
  getShortcutByTrigger,
  addShortcut,
  updateShortcut,
  removeShortcut,
  validateTriggerFormat,
  validateTrigger,
} from "../shortcuts.js";

// ============================================================================
// Command Handlers
// ============================================================================

/**
 * dash -- add <trigger> <cmd...> [--name "Name"] [--case-sensitive]
 */
const handleAdd: CommandHandler = async (args, flags, fmt) => {
  if (args.length < 2) {
    fmt.error("Usage: dash -- add <trigger> <command...> [--name \"Name\"] [--case-sensitive]");
  }

  const trigger = args[0];
  const commands = args.slice(1);

  // Validate trigger format (includes -- check)
  const formatResult = validateTriggerFormat(trigger);
  if (!formatResult.valid) {
    fmt.error(formatResult.error || "Invalid trigger format");
  }

  const caseSensitive = flags["case-sensitive"] === true;
  const name = typeof flags.name === "string" ? flags.name : trigger;

  // Check for collision
  const collisionResult = validateTrigger(trigger, caseSensitive);
  if (!collisionResult.valid) {
    fmt.error(collisionResult.error || "Trigger already exists");
  }

  try {
    const shortcut = addShortcut({
      name,
      trigger,
      caseSensitive,
      command: commands,
    });

    if (flags.json) {
      fmt.json({ success: true, shortcut });
    } else {
      fmt.success(`Added: ${shortcut.trigger}`);
    }
  } catch (err) {
    fmt.error(err instanceof Error ? err.message : "Failed to add shortcut");
  }
};

/**
 * dash -- list [--json]
 */
const handleList: CommandHandler = async (_args, flags, fmt) => {
  const shortcuts = getShortcuts();

  if (flags.json) {
    fmt.json({ shortcuts });
    return;
  }

  const rows: ShortcutRow[] = shortcuts.map((s) => ({
    trigger: s.trigger,
    name: s.name,
    commands: s.command.join(", "),
  }));

  fmt.table(rows);
};

/**
 * dash -- show <trigger> [--json]
 */
const handleShow: CommandHandler = async (args, flags, fmt) => {
  if (args.length < 1) {
    fmt.error("Usage: dash -- show <trigger>");
  }

  const trigger = args[0];
  const shortcut = getShortcutByTrigger(trigger);

  if (!shortcut) {
    fmt.error(`Shortcut not found: ${trigger}`);
  }

  if (flags.json) {
    fmt.json({ shortcut });
    return;
  }

  // Human-readable detailed view
  console.log(`  Trigger:  ${shortcut.trigger}`);
  console.log(`  Name:     ${shortcut.name}`);
  console.log(`  Case:     ${shortcut.caseSensitive ? "sensitive" : "insensitive"}`);
  console.log(`  Commands:`);
  for (const cmd of shortcut.command) {
    console.log(`    ${cmd}`);
  }
};

/**
 * dash -- edit <trigger> [--name] [--trigger] [--command] [--case-sensitive] [--json]
 */
const handleEdit: CommandHandler = async (args, flags, fmt) => {
  if (args.length < 1) {
    fmt.error("Usage: dash -- edit <trigger> [--name \"Name\"] [--trigger new] [--command \"cmd1\" --command \"cmd2\"] [--case-sensitive]");
  }

  const trigger = args[0];
  const shortcut = getShortcutByTrigger(trigger);

  if (!shortcut) {
    fmt.error(`Shortcut not found: ${trigger}`);
  }

  // Build update object from flags
  const updates: Partial<{
    name: string;
    trigger: string;
    caseSensitive: boolean;
    command: string[];
  }> = {};

  if (typeof flags.name === "string") {
    updates.name = flags.name;
  }

  if (typeof flags.trigger === "string") {
    // Validate new trigger format
    const formatResult = validateTriggerFormat(flags.trigger);
    if (!formatResult.valid) {
      fmt.error(formatResult.error || "Invalid trigger format");
    }

    // Check collision (excluding current shortcut)
    const caseSensitive = flags["case-sensitive"] === true ? true : shortcut.caseSensitive;
    const collisionResult = validateTrigger(flags.trigger, caseSensitive, shortcut.id);
    if (!collisionResult.valid) {
      fmt.error(collisionResult.error || "Trigger already exists");
    }

    updates.trigger = flags.trigger;
  }

  if (flags["case-sensitive"] !== undefined) {
    updates.caseSensitive = flags["case-sensitive"] === true;
  }

  if (typeof flags.command === "string") {
    // Single command or comma-separated
    updates.command = flags.command.includes(",")
      ? flags.command.split(",").map((c) => c.trim())
      : [flags.command];
  }

  // Check if any updates provided
  if (Object.keys(updates).length === 0) {
    fmt.error("No updates provided. Use --name, --trigger, --command, or --case-sensitive");
  }

  try {
    const updated = updateShortcut(shortcut.id, updates);

    if (flags.json) {
      fmt.json({ success: true, shortcut: updated });
    } else {
      fmt.success(`Updated: ${updated.trigger}`);
    }
  } catch (err) {
    fmt.error(err instanceof Error ? err.message : "Failed to update shortcut");
  }
};

/**
 * dash -- rm <trigger> [--json]
 */
const handleRm: CommandHandler = async (args, flags, fmt) => {
  if (args.length < 1) {
    fmt.error("Usage: dash -- rm <trigger>");
  }

  const trigger = args[0];
  const shortcut = getShortcutByTrigger(trigger);

  if (!shortcut) {
    fmt.error(`Shortcut not found: ${trigger}`);
  }

  const deleted = removeShortcut(shortcut.id);

  if (!deleted) {
    fmt.error("Failed to remove shortcut");
  }

  if (flags.json) {
    fmt.json({ deleted: true, trigger: shortcut.trigger });
  } else {
    fmt.success(`Removed shortcut: ${shortcut.trigger}`);
  }
};

// ============================================================================
// Command Registry
// ============================================================================

export const commands: Record<string, CommandHandler> = {
  add: handleAdd,
  list: handleList,
  show: handleShow,
  edit: handleEdit,
  rm: handleRm,
};

export function showHelp(fmt: OutputFormatter): void {
  console.log(`Usage: dash -- <command> [args] [flags]

Commands:
  add <trigger> <cmd...>  Add shortcut (--name, --case-sensitive)
  list                    List all shortcuts (--json)
  show <trigger>          Show shortcut details (--json)
  edit <trigger>          Edit shortcut (--name, --trigger, --command, --case-sensitive, --json)
  rm <trigger>            Remove shortcut (--json)

Flags:
  --json                  Output in JSON format
  --name "Name"           Set display name
  --case-sensitive        Make trigger case-sensitive
  --command "cmd"         Set command(s)

Examples:
  dash -- add proj "cd /projects/myproj" "code ."
  dash -- add proj "cd /foo" --name "My Project"
  dash -- list --json
  dash -- show proj
  dash -- edit proj --name "New Name" --case-sensitive
  dash -- rm proj`);
}
