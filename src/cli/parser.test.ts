import { describe, expect, it } from "vitest";
import { parseArgv } from "./parser.js";

describe("parseArgv", () => {
  it("returns empty state for no command", () => {
    expect(parseArgv([])).toEqual({ command: null, positional: [], flags: {} });
  });

  it("parses positional arguments and boolean or valued flags", () => {
    expect(parseArgv(["add", "proj", "cd /work", "--name", "Project", "--json"])).toEqual({
      command: "add",
      positional: ["proj", "cd /work"],
      flags: { name: "Project", json: true },
    });
  });
});
