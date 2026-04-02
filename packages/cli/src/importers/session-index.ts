import { readFileSync } from "fs";
import type { SessionIndexFile } from "@cc-timetravel/shared";

export function readSessionIndex(filePath: string): SessionIndexFile {
  const content = readFileSync(filePath, "utf-8");
  return JSON.parse(content) as SessionIndexFile;
}
