#!/usr/bin/env node

import { Command } from "commander";
import { deployCommand } from "../commands/deploy.js";
import { build } from "@fnly/core";
import { devCommand } from "../commands/dev.js";

const program = new Command();

program
  .name("fnly")
  .description("CLI tool for building and deploying your functions")
  .version("0.0.0");

program
  .command("build")
  .description("Build functions")
  .action(async () => {
    await build(process.cwd());
  });

program
  .command("deploy")
  .description("Deploy your functions to Fnly")
  .action(async () => {
    await deployCommand();
  });

program
  .command("dev")
  .description("Start the development server")
  .action(async () => {
    await devCommand();
  });

program.parse();
