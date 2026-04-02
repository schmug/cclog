import { describe, it, expect } from "vitest";
import { Redactor } from "../redaction/redactor.js";

describe("Redactor", () => {
  it("redacts tool outputs when rule enabled", () => {
    const r = new Redactor(["redact-tool-outputs"]);
    expect(r.redactToolOutput("some tool output")).toBe("[REDACTED]");
  });

  it("preserves tool outputs when rule disabled", () => {
    const r = new Redactor([]);
    expect(r.redactToolOutput("some tool output")).toBe("some tool output");
  });

  it("redacts code blocks", () => {
    const r = new Redactor(["redact-code"]);
    const input = 'Here is some code:\n```\nconsole.log("hello");\n```\nDone.';
    const result = r.redactText(input);
    expect(result).not.toContain("console.log");
    expect(result).toContain("[CODE REDACTED]");
  });

  it("redacts file paths", () => {
    const r = new Redactor(["redact-paths"]);
    const input = "Error in /home/user/projects/myapp/src/index.ts at line 42";
    const result = r.redactText(input);
    expect(result).not.toContain("/home/user/projects/myapp/src/index.ts");
    expect(result).toContain("[PATH:");
  });

  it("redacts custom patterns", () => {
    const r = new Redactor(["redact-pattern:secret-\\w+"]);
    const input = "The token is secret-abc123 and secret-xyz789";
    const result = r.redactText(input);
    expect(result).not.toContain("secret-abc123");
    expect(result).not.toContain("secret-xyz789");
    expect(result).toBe("The token is [REDACTED] and [REDACTED]");
  });

  it("composes multiple rules (code + paths)", () => {
    const r = new Redactor(["redact-code", "redact-paths"]);
    const input =
      "File at /var/log/app/server.log:\n```\nerror details here\n```";
    const result = r.redactText(input);
    expect(result).not.toContain("/var/log/app/server.log");
    expect(result).not.toContain("error details here");
    expect(result).toContain("[PATH:");
    expect(result).toContain("[CODE REDACTED]");
  });
});
