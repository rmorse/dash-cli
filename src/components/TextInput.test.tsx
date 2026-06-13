import React from "react";
import { describe, expect, it, vi } from "vitest";
import TextInput from "./TextInput.js";
import { renderInk } from "../test/ink.js";

describe("TextInput", () => {
  it("submits pasted text through onChange and onSubmit", async () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    const app = renderInk(
      <TextInput value="" placeholder="Trigger" onChange={onChange} onSubmit={onSubmit} />
    );

    await app.input("proj");
    await app.input("\r");

    expect(onChange).toHaveBeenCalledWith("proj");
    expect(onSubmit).toHaveBeenCalledWith("");
    app.cleanup();
  });

  it("renders masked values and cursor placeholders", () => {
    const masked = renderInk(<TextInput value="secret" mask="*" onChange={vi.fn()} />);
    expect(masked.output()).toContain("******");
    masked.cleanup();

    const placeholder = renderInk(<TextInput value="" placeholder="Trigger" onChange={vi.fn()} />);
    expect(placeholder.output()).toContain("Trigger");
    placeholder.cleanup();
  });

  it("appends input to the current value", async () => {
    const onChange = vi.fn();
    const app = renderInk(<TextInput value="abc" onChange={onChange} />);

    await app.input("z");
    expect(onChange).toHaveBeenCalledWith("abcz");
    app.cleanup();
  });
});
