import type { Shortcut } from "../types.js";

export interface ParsedArgs {
  command: string | null;
  positional: string[];
  flags: Record<string, string | boolean>;
}

export interface OutputFormatter {
  success(message: string, data?: unknown): void;
  error(message: string): never;
  table(rows: ShortcutRow[]): void;
  json(data: unknown): void;
}

export interface ShortcutRow {
  trigger: string;
  name: string;
  commands: string;
}

export type CommandHandler = (
  args: string[],
  flags: Record<string, string | boolean>,
  fmt: OutputFormatter
) => Promise<void>;
