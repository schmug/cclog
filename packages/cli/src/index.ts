#!/usr/bin/env node
import { Command } from "commander";
import { importCommand } from "./commands/import.js";

const program = new Command()
  .name("cc-timetravel")
  .description(
    "Claude Code history viewer — analytics, search, and LLM insights"
  )
  .version("0.1.0");

program.addCommand(importCommand);
program.parse();
