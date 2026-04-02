import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import { AppConfig, DEFAULT_CONFIG } from "@cclog/shared";

export function getConfigPath(): string {
  return join(homedir(), ".config", "cclog", "config.json");
}

export function loadConfig(): AppConfig {
  const configPath = getConfigPath();
  try {
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    // Deep merge with defaults so missing keys fall back
    return {
      llm: { ...DEFAULT_CONFIG.llm, ...parsed.llm },
      redaction: { ...DEFAULT_CONFIG.redaction, ...parsed.redaction },
      import: { ...DEFAULT_CONFIG.import, ...parsed.import },
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: AppConfig): void {
  const configPath = getConfigPath();
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}
