import { describe, expect, it } from "vitest";

import { commandsOnly, parseTerminalLines } from "@/lib/doc-components/terminal";

describe("parseTerminalLines", () => {
  it("classifies a commands-only block", () => {
    const lines = parseTerminalLines("$ npm install\n$ npm run build");
    expect(lines).toEqual([
      { kind: "command", prompt: "$", text: "npm install" },
      { kind: "command", prompt: "$", text: "npm run build" },
    ]);
  });

  it("classifies an output-only block", () => {
    const lines = parseTerminalLines("added 1 package in 2s\nfound 0 vulnerabilities");
    expect(lines).toEqual([
      { kind: "output", text: "added 1 package in 2s" },
      { kind: "output", text: "found 0 vulnerabilities" },
    ]);
  });

  it("classifies an interleaved block", () => {
    const lines = parseTerminalLines("$ npm install\nadded 1 package\n$ npm test\nAll tests passed");
    expect(lines).toEqual([
      { kind: "command", prompt: "$", text: "npm install" },
      { kind: "output", text: "added 1 package" },
      { kind: "command", prompt: "$", text: "npm test" },
      { kind: "output", text: "All tests passed" },
    ]);
  });

  it("preserves blank lines inside output", () => {
    const lines = parseTerminalLines("$ npm install\n\nadded 1 package");
    expect(lines).toEqual([
      { kind: "command", prompt: "$", text: "npm install" },
      { kind: "output", text: "" },
      { kind: "output", text: "added 1 package" },
    ]);
  });

  it("classifies '>' continuation lines as commands", () => {
    const lines = parseTerminalLines("$ multi \\\n> line \\\n> command");
    expect(lines).toEqual([
      { kind: "command", prompt: "$", text: "multi \\" },
      { kind: "command", prompt: ">", text: "line \\" },
      { kind: "command", prompt: ">", text: "command" },
    ]);
  });

  it("classifies a block with no prompts at all as entirely output", () => {
    const lines = parseTerminalLines("Server running at http://localhost:3000\nReady in 400ms");
    expect(lines.every((line) => line.kind === "output")).toBe(true);
  });
});

describe("commandsOnly", () => {
  it("joins only command lines, prompts stripped", () => {
    const lines = parseTerminalLines("$ npm install\nadded 1 package\n$ npm run build");
    expect(commandsOnly(lines)).toBe("npm install\nnpm run build");
  });

  it("returns an empty string for an all-output block", () => {
    const lines = parseTerminalLines("just output\nmore output");
    expect(commandsOnly(lines)).toBe("");
  });
});
