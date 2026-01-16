import type { OutputFormatter, ShortcutRow } from "./types.js";

export class HumanFormatter implements OutputFormatter {
  success(message: string, _data?: unknown): void {
    console.log(`✓ ${message}`);
  }

  error(message: string): never {
    console.error(`Error: ${message}`);
    process.exit(1);
  }

  table(rows: ShortcutRow[]): void {
    if (rows.length === 0) {
      console.log("No shortcuts configured.");
      return;
    }

    // Calculate column widths
    const triggerWidth = Math.max(7, ...rows.map((r) => r.trigger.length));
    const nameWidth = Math.max(4, ...rows.map((r) => r.name.length));

    console.log("Shortcuts:");
    for (const row of rows) {
      const trigger = row.trigger.padEnd(triggerWidth);
      const name = row.name.padEnd(nameWidth);
      console.log(`  ${trigger}  ${name}  ${row.commands}`);
    }
  }

  json(data: unknown): void {
    console.log(JSON.stringify(data, null, 2));
  }
}

export class JsonFormatter implements OutputFormatter {
  success(message: string, data?: unknown): void {
    console.log(JSON.stringify({ success: true, message, ...((data as object) || {}) }));
  }

  error(message: string): never {
    console.log(JSON.stringify({ error: message }));
    process.exit(1);
  }

  table(rows: ShortcutRow[]): void {
    // Not used directly - list command outputs full shortcut data
    console.log(JSON.stringify(rows));
  }

  json(data: unknown): void {
    console.log(JSON.stringify(data));
  }
}

export function createFormatter(useJson: boolean): OutputFormatter {
  return useJson ? new JsonFormatter() : new HumanFormatter();
}
