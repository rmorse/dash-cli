import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HumanFormatter, JsonFormatter, createFormatter } from "./formatters.js";

let logs: string[] = [];
let errors: string[] = [];

beforeEach(() => {
  logs = [];
  errors = [];
  vi.spyOn(console, "log").mockImplementation((message = "") => {
    logs.push(String(message));
  });
  vi.spyOn(console, "error").mockImplementation((message = "") => {
    errors.push(String(message));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("formatters", () => {
  it("formats human success, JSON, and tables", () => {
    const formatter = new HumanFormatter();

    formatter.success("Saved");
    formatter.json({ ok: true });
    formatter.table([{ trigger: "p", name: "Project", commands: "cd /p" }]);
    formatter.table([]);

    expect(logs).toContain("✓ Saved");
    expect(logs).toContain(JSON.stringify({ ok: true }, null, 2));
    expect(logs.join("\n")).toContain("Shortcuts:");
    expect(logs.join("\n")).toContain("No shortcuts configured.");
  });

  it("formats JSON responses", () => {
    const formatter = new JsonFormatter();

    formatter.success("Saved", { id: 1 });
    formatter.table([{ trigger: "p", name: "Project", commands: "cd /p" }]);
    formatter.json({ ok: true });

    expect(logs.map((line) => JSON.parse(line))).toEqual([
      { success: true, message: "Saved", id: 1 },
      [{ trigger: "p", name: "Project", commands: "cd /p" }],
      { ok: true },
    ]);
  });

  it("exits on errors", () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit");
    }) as never);

    expect(() => new HumanFormatter().error("Broken")).toThrow("exit");
    expect(errors).toEqual(["Error: Broken"]);

    expect(() => new JsonFormatter().error("Broken")).toThrow("exit");
    expect(JSON.parse(logs.at(-1)!)).toEqual({ error: "Broken" });
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("creates the requested formatter kind", () => {
    expect(createFormatter(false)).toBeInstanceOf(HumanFormatter);
    expect(createFormatter(true)).toBeInstanceOf(JsonFormatter);
  });
});
