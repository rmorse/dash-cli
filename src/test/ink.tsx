import React from "react";
import { PassThrough, Writable } from "node:stream";
import { render, type Instance } from "ink";

type TestStdin = PassThrough & {
  isTTY: boolean;
  setRawMode: (enabled: boolean) => void;
  ref: () => TestStdin;
  unref: () => TestStdin;
};

class TestStdout extends Writable {
  columns = 80;
  rows = 24;
  isTTY = true;
  output = "";

  _write(
    chunk: string | Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    this.output += chunk.toString();
    callback();
  }
}

const stripAnsi = (value: string): string =>
  value
    .replace(/\u001B\][^\u0007]*(?:\u0007|\u001B\\)/g, "")
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\u001B[=>]/g, "");

export interface InkTestInstance extends Instance {
  stdin: TestStdin;
  stdout: TestStdout;
  input: (value: string) => Promise<void>;
  output: () => string;
  cleanup: () => void;
}

export function renderInk(node: React.ReactNode): InkTestInstance {
  const stdout = new TestStdout();
  const stderr = new TestStdout();
  const stdin = new PassThrough() as TestStdin;

  stdin.isTTY = true;
  stdin.setRawMode = () => undefined;
  stdin.ref = () => stdin;
  stdin.unref = () => stdin;

  const instance = render(node, {
    stdout: stdout as unknown as NodeJS.WriteStream,
    stderr: stderr as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    debug: true,
    exitOnCtrlC: false,
    patchConsole: false,
  });

  return {
    ...instance,
    stdin,
    stdout,
    async input(value: string) {
      await waitForInk();
      stdin.write(value);
      await waitForInk();
    },
    output() {
      return stripAnsi(stdout.output);
    },
    cleanup() {
      instance.unmount();
      instance.cleanup();
      stdin.destroy();
      stdout.destroy();
      stderr.destroy();
    },
  };
}

export async function waitForInk(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

export async function waitForOutput(
  app: Pick<InkTestInstance, "output">,
  matcher: string | RegExp,
  timeoutMs = 1000
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const output = app.output();
    const matches = typeof matcher === "string"
      ? output.includes(matcher)
      : matcher.test(output);

    if (matches) {
      return;
    }

    await waitForInk();
  }

  throw new Error(`Timed out waiting for output: ${String(matcher)}\n${app.output()}`);
}
