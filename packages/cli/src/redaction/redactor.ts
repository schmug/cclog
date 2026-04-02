import { createHash } from "crypto";

const CODE_BLOCK_RE = /```[\s\S]*?```/g;
// Match absolute paths with 3+ segments: /a/b/c or /a/b/c/d/...
const ABS_PATH_RE = /\/[^\s/:*?"<>|]+(?:\/[^\s/:*?"<>|]+){2,}/g;

export class Redactor {
  private redactToolOutputs: boolean;
  private redactCode: boolean;
  private redactPaths: boolean;
  private customPatterns: RegExp[];

  constructor(rules: string[]) {
    this.redactToolOutputs = rules.includes("redact-tool-outputs");
    this.redactCode = rules.includes("redact-code");
    this.redactPaths = rules.includes("redact-paths");
    this.customPatterns = rules
      .filter((r) => r.startsWith("redact-pattern:"))
      .map((r) => new RegExp(r.slice("redact-pattern:".length), "g"));
  }

  redactToolOutput(text: string): string {
    if (this.redactToolOutputs) {
      return "[REDACTED]";
    }
    return this.redactText(text);
  }

  redactText(text: string): string {
    let result = text;

    if (this.redactCode) {
      result = result.replace(CODE_BLOCK_RE, "[CODE REDACTED]");
    }

    if (this.redactPaths) {
      result = result.replace(ABS_PATH_RE, (match) => {
        const hash = createHash("sha256")
          .update(match)
          .digest("hex")
          .slice(0, 8);
        return `[PATH:${hash}]`;
      });
    }

    for (const pattern of this.customPatterns) {
      // Reset lastIndex to ensure global patterns work correctly across calls
      pattern.lastIndex = 0;
      result = result.replace(pattern, "[REDACTED]");
    }

    return result;
  }
}
