#!/usr/bin/env node
import { Command } from "commander";
import { importCommand } from "./commands/import.js";
import { embedCommand } from "./commands/embed.js";
import { summarizeCommand } from "./commands/summarize.js";
import { exportCommand } from "./commands/export.js";
import { serveCommand } from "./commands/serve.js";
import { configCommand } from "./commands/config.js";

const program = new Command()
  .name("cclog")
  .description(
    "Claude Code history viewer — analytics, search, and LLM insights"
  )
  .version("0.1.0");

program.addCommand(importCommand);
program.addCommand(embedCommand);
program.addCommand(summarizeCommand);
program.addCommand(exportCommand);
program.addCommand(serveCommand);
program.addCommand(configCommand);
program.parse();
