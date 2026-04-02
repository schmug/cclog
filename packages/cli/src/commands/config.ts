import { Command } from "commander";
import { loadConfig, saveConfig, getConfigPath } from "../config.js";
import { AppConfig } from "@cclog/shared";

export const configCommand = new Command("config")
  .description("View or modify configuration")
  .action(() => {
    const config = loadConfig();
    const configPath = getConfigPath();
    console.log(`# Config file: ${configPath}`);
    console.log(JSON.stringify(config, null, 2));
  });

configCommand
  .command("set <key> <value>")
  .description('Set a config value by dot-separated key (e.g. "llm.provider")')
  .action((key: string, value: string) => {
    const config = loadConfig() as Record<string, unknown>;
    const parts = key.split(".");

    // Traverse to the parent object
    let current: Record<string, unknown> = config;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (
        current[part] === undefined ||
        current[part] === null ||
        typeof current[part] !== "object"
      ) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    // Set the leaf value (try to parse as JSON, fall back to string)
    const leaf = parts[parts.length - 1];
    let parsedValue: unknown = value;
    try {
      parsedValue = JSON.parse(value);
    } catch {
      // keep as string
    }
    current[leaf] = parsedValue;

    saveConfig(config as AppConfig);
    console.log(`Set ${key} = ${JSON.stringify(parsedValue)}`);
  });
